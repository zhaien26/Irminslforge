/* =========================================================================
   Irminsul Forge — tracker core
   Pure logic, no DOM. Used by tracker.html / index.html / builder.html and
   by the node test suite (test/core.test.mjs), so what you see in the page is
   exactly what is tested.

   Everything here answers one question: for a character you have configured
   (level + talent levels + materials you already own), what is still ahead,
   where do you get it, when can you farm it, and how long will that take.
   ========================================================================= */
(function (root, factory) {
  var api = factory(root.forgeData || root.FORGE || (typeof require === "function" ? require("./data.js") : {}));
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeCore = api;
})(typeof self !== "undefined" ? self : this, function (DATA) {
  "use strict";

  /* ---------- static curves (the parts of Genshin that never change) ------ */
  var CAPS = [20, 40, 50, 60, 70, 80, 90];          // level cap at each ascension
  var ASC_MORA = [20000, 40000, 60000, 80000, 100000, 120000]; // mora per ascension
  var TAL_MORA = [12500, 17500, 25000, 30000, 37500, 120000, 260000, 450000, 700000];
  var TALENT_MAX = 10;

  /* Per-talent cost curve, indexed by the level you are going TO (2..10).
     Keys are resolved against the character's own material names, so this one
     table covers every character including ones with no talSteps in the data. */
  var TAL_CURVE = {
    2: { teachings: 3, mob1: 6 },
    3: { guide: 2, mob2: 3 },
    4: { guide: 4, mob2: 4 },
    5: { guide: 6, mob2: 6 },
    6: { guide: 9, mob2: 9 },
    7: { phil: 4, weekly: 1, mob3: 4 },
    8: { phil: 6, weekly: 1, mob3: 6 },
    9: { phil: 12, weekly: 2, mob3: 9 },
    10: { phil: 16, weekly: 2, mob3: 12, crown: 1 }
  };

  /* What one week of normal play yields per source. Deliberately conservative,
     and editable in the UI (settings), because resin habits differ. */
  var RATES = {
    book: 252,        // 3 domain days/week × ~84 books at 240 resin
    mob: 320,         // enemy drops, farmable any day
    specialty: 168,   // local specialty, ~24/day
    boss: 90,         // normal boss material, resin-limited
    gem: 45,          // weekly draws + conversion
    weekly: 1,        // weekly boss: one drop per boss per week
    crown: 0.25       // Crown of Insight: ~1 per patch
  };

  var MAT_LABEL = {
    gem: "Ascension gem", specialty: "Local specialty", boss: "Boss material",
    book: "Talent book", weekly: "Weekly boss", crown: "Crown", mob: "Enemy drop"
  };
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var CHARS = DATA.chars || [];
  var MATS = DATA.mats || {};
  var BY_NAME = {};
  CHARS.forEach(function (c) { BY_NAME[c.n] = c; });

  /* ---------- helpers ----------------------------------------------------- */
  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) n = lo; return Math.max(lo, Math.min(hi, n)); }
  function addRows(into, rows) {
    (rows || []).forEach(function (r) {
      var name = r[0], cat = r[2] || catOf(name);
      into[name] = { want: (into[name] ? into[name].want : 0) + r[1], cat: cat };
    });
    return into;
  }
  function catOf(name) {
    if (/Sliver|Fragment|Chunk|Gemstone/.test(name)) return "gem";
    if (/^Teachings of |^Guide to |^Philosophies of /.test(name)) return "book";
    if (/Crown of Insight/.test(name)) return "crown";
    return "mob";
  }
  function add(need, have) {
    return Object.keys(need).map(function (n) {
      var want = need[n].want, got = Math.max(0, Math.floor(Number(have && have[n]) || 0));
      return { name: n, cat: need[n].cat, want: want, have: got, miss: Math.max(0, want - got) };
    }).sort(function (a, b) { return b.miss - a.miss || a.name.localeCompare(b.name); });
  }
  function sum(rows, key) { return rows.reduce(function (a, r) { return a + r[key]; }, 0); }
  /* how far a material list is collected: 100 when nothing is missing */
  function collected(rows) {
    var want = sum(rows, "want");
    if (want <= 0) return 100;
    return Math.round(((want - sum(rows, "miss")) / want) * 100);
  }
  function ascStage(lvl) {
    for (var i = 0; i < 6; i++) if (lvl <= CAPS[i]) return i;
    return 6;
  }
  function slugOf(n) {
    return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function seriesOf(bookName) {
    return String(bookName).replace(/^(Teachings of |Guide to |Philosophies of )/, "");
  }

  /* ---------- material names for a character ------------------------------ */
  /* Pull the character's own book / mob / weekly names out of the data so the
     generic curve above can be applied even when talSteps is missing. */
  /* The Traveler has no fixed materials (they follow the element you are
     attuned to), so the site ships an empty list. Rather than showing nothing,
     fall back to the standard totals — the most common 6-phase structure found
     in the roster — with clearly-labelled generic rows. */
  function phaseSignature(phases) {
    return phases.map(function (ph) {
      return ph.map(function (r) { return r[2] + ":" + r[1]; }).sort().join("|");
    }).join(";");
  }
  var TEMPLATES = (function () {
    var tally = {};
    CHARS.forEach(function (c) {
      var m = MATS[c.n];
      if (!m || !m.ascPhases || m.ascPhases.length !== 6) return;
      var sig = phaseSignature(m.ascPhases);
      var t = tally[sig] || (tally[sig] = { n: 0, src: c.n, e: c.e });
      t.n++;
    });
    var best = null;
    Object.keys(tally).forEach(function (k) { if (!best || tally[k].n > best.n) best = { n: tally[k].n, k: k, src: tally[k].src }; });
    return best ? { src: best.src, phases: MATS[best.src].ascPhases, steps: MATS[best.src].talSteps } : null;
  })();
  var GENERIC = {
    specialty: "Local specialty (follows your element)",
    boss: "Boss material (follows your element)",
    mob1: "Enemy drop · tier 1", mob2: "Enemy drop · tier 2", mob3: "Enemy drop · tier 3",
    book: "Talent books (follow your element)", weekly: "Weekly boss drop (follows your element)"
  };
  /* gem line per element, lifted straight from the roster data */
  var GEMS = (function () {
    var out = {};
    CHARS.forEach(function (c) {
      if (out[c.e]) return;
      var m = MATS[c.n];
      if (!m || !m.asc || !m.asc.items) return;
      var row = m.asc.items.filter(function (r) { return r[2] === "gem"; }).map(function (r) { return r[0]; });
      if (row.length === 4) out[c.e] = row;
    });
    return out;
  })();

  function generic(name) {
    var m = MATS[name], c = BY_NAME[name];
    if (!m || !TEMPLATES || !c) return null;
    var gems = GEMS[c.e] || ["Ascension gem (Sliver)", "Ascension gem (Fragment)", "Ascension gem (Chunk)", "Ascension gem (Gemstone)"];
    var g = { sliver: gems[0], frag: gems[1], chunk: gems[2], stone: gems[3] };
    var ph = [
      [[g.sliver, 1, "gem"], [GENERIC.specialty, 3, "specialty"], [GENERIC.mob1, 3, "mob"]],
      [[g.frag, 3, "gem"], [GENERIC.boss, 2, "boss"], [GENERIC.specialty, 10, "specialty"], [GENERIC.mob1, 15, "mob"]],
      [[g.frag, 6, "gem"], [GENERIC.boss, 4, "boss"], [GENERIC.specialty, 20, "specialty"], [GENERIC.mob2, 12, "mob"]],
      [[g.chunk, 3, "gem"], [GENERIC.boss, 8, "boss"], [GENERIC.specialty, 30, "specialty"], [GENERIC.mob2, 18, "mob"]],
      [[g.chunk, 6, "gem"], [GENERIC.boss, 12, "boss"], [GENERIC.specialty, 45, "specialty"], [GENERIC.mob3, 12, "mob"]],
      [[g.stone, 6, "gem"], [GENERIC.boss, 20, "boss"], [GENERIC.specialty, 60, "specialty"], [GENERIC.mob3, 24, "mob"]]
    ];
    return { ascPhases: ph, generic: true };
  }
  function isGenericRow(name) {
    return Object.keys(GENERIC).some(function (k) { return GENERIC[k] === name; });
  }
  function ascPhasesFor(name) {
    var m = MATS[name];
    if (m && m.ascPhases && m.ascPhases.length) return m.ascPhases;
    var t = generic(name);
    return t ? t.ascPhases : [];
  }

  function namesFor(name) {
    var m = MATS[name];
    var out = { books: {}, mobs: [], weekly: null, crown: "Crown of Insight", generic: false };
    if (!m) return out;
    var isEmpty = !(m.tal && m.tal.items && m.tal.items.length);
    if (isEmpty) {
      var c = BY_NAME[name];
      out.generic = true;
      out.books = { t: GENERIC.book, g: GENERIC.book, p: GENERIC.book, s: null };
      out.mobs = [GENERIC.mob1, GENERIC.mob2, GENERIC.mob3];
      out.weekly = GENERIC.weekly;
      return out;
    }
    var rows = (m.tal && m.tal.items ? m.tal.items : []).concat(m.talSteps ? m.talSteps.flat() : []);
    rows.forEach(function (r) {
      var n = r[0], cat = r[2];
      if (cat === "book") {
        var s = seriesOf(n);
        if (/^Teachings of /.test(n)) out.books.t = n;
        else if (/^Guide to /.test(n)) out.books.g = n;
        else if (/^Philosophies of /.test(n)) out.books.p = n;
        out.books.s = out.books.s || s;
      } else if (cat === "weekly") {
        out.weekly = n;
      } else if (cat === "crown") {
        out.crown = n;
      }
    });
    /* mob drops come in three tiers, in the order the data lists them */
    var seen = {};
    (m.tal && m.tal.items ? m.tal.items : []).forEach(function (r) {
      if (r[2] === "mob" && !seen[r[0]]) { seen[r[0]] = 1; out.mobs.push(r[0]); }
    });
    if (out.mobs.length < 3 && m.ascPhases) {
      m.ascPhases.forEach(function (ph) {
        ph.forEach(function (r) {
          if (r[2] === "mob" && out.mobs.indexOf(r[0]) < 0) out.mobs.push(r[0]);
        });
      });
    }
    return out;
  }

  /* per-level talent steps for a character: real data when present, else the
     generic curve resolved against that character's material names */
  function talStepsFor(name) {
    var m = MATS[name];
    if (m && m.talSteps && m.talSteps.length === 9) return m.talSteps;
    var nm = namesFor(name);
    if (!nm.books.t || nm.mobs.length < 3) return (m && m.talSteps) || null;
    var steps = [];
    for (var lv = 2; lv <= 10; lv++) {
      var c = TAL_CURVE[lv], rows = [];
      if (c.teachings) rows.push([nm.books.t, c.teachings, "book"]);
      if (c.guide) rows.push([nm.books.g, c.guide, "book"]);
      if (c.phil) rows.push([nm.books.p, c.phil, "book"]);
      if (c.mob1) rows.push([nm.mobs[0], c.mob1, "mob"]);
      if (c.mob2) rows.push([nm.mobs[1], c.mob2, "mob"]);
      if (c.mob3) rows.push([nm.mobs[2], c.mob3, "mob"]);
      if (c.weekly && nm.weekly) rows.push([nm.weekly, c.weekly, "weekly"]);
      if (c.crown) rows.push([nm.crown, c.crown, "crown"]);
      steps.push(rows);
    }
    return steps;
  }

  /* ---------- the plan for one character --------------------------------- */
  /* st = { lvl, tal:[a,b,c], have:{material:count} } — your saved state. */
  function plan(name, st) {
    var m = MATS[name];
    st = st || {};
    var lvl = clamp(st.lvl, 1, 90), tal = [0, 1, 2].map(function (i) {
      return clamp((st.tal || [])[i] === undefined ? 1 : st.tal[i], 1, TALENT_MAX);
    });
    var have = st.have || {};
    if (!m) return { name: name, ok: false, lvl: lvl, tal: tal, stage: ascStage(lvl) };

    var stage = ascStage(lvl);
    var ascRows = {}, nextRows = {};
    var phases = ascPhasesFor(name);
    var genericPlan = !(m.ascPhases && m.ascPhases.length);
    phases.slice(stage).forEach(function (ph) { addRows(ascRows, ph); });
    addRows(nextRows, phases[stage] || []);

    var steps = talStepsFor(name) || [];
    var talNeed = {}, talMora = 0;
    for (var t = 0; t < 3; t++) {
      for (var lv = tal[t] + 1; lv <= TALENT_MAX; lv++) {
        addRows(talNeed, (steps || [])[lv - 2]);
        talMora += TAL_MORA[lv - 2] || 0;
      }
    }
    var asc = add(ascRows, have), next = add(nextRows, have), talent = add(talNeed, have);
    var all = asc.concat(talent);
    var ascWant = sum(asc, "want"), ascMiss = sum(asc, "miss");
    var talWant = sum(talent, "want"), talMiss = sum(talent, "miss");
    var crowns = all.filter(function (r) { return r.cat === "crown"; });
    var levelCap = stage >= 6 ? 90 : CAPS[stage];
    var levelPct = Math.round((lvl / 90) * 100);

    var p = {
      name: name, ok: true, lvl: lvl, tal: tal, stage: stage,
      levelCap: levelCap, fullyAscended: stage >= 6,
      asc: { rows: asc, want: ascWant, miss: ascMiss, pct: collected(asc), mora: ASC_MORA.slice(stage).reduce(function (a, b) { return a + b; }, 0) },
      talent: { rows: talent, want: talWant, miss: talMiss, pct: collected(talent), mora: talMora },
      next: { rows: next, want: sum(next, "want"), miss: sum(next, "miss"), ready: stage < 6 && sum(next, "miss") === 0 && lvl >= levelCap },
      crowns: sum(crowns, "miss"), crownsWant: sum(crowns, "want"),
      missing: ascMiss + talMiss, want: ascWant + talWant,
      mora: ASC_MORA.slice(stage).reduce(function (a, b) { return a + b; }, 0) + talMora,
      steps: !!m.talSteps, generic: genericPlan
    };
    /* one honest number for "how close is this build":
       a quarter level, three quarters collected materials */
    var matFrac = p.want > 0 ? (p.want - p.missing) / p.want * 100 : 100;
    p.levelPct = levelPct;
    p.matPct = Math.round(matFrac);
    p.pct = Math.round(levelPct * 0.25 + matFrac * 0.75);
    p.touched = lvl > 1 || tal.some(function (t) { return t > 1; }) || Object.keys(have).some(function (k) { return have[k] > 0; });
    p.bottleneck = bottleneckFor(p, RATES);
    p.eta = etaFor(p, RATES);
    return p;
  }

  function weeksFor(miss, perWeek) {
    if (!miss) return 0;
    return Math.round((miss / Math.max(0.01, perWeek)) * 10) / 10;
  }
  /* the slowest source in the plan decides how long the character takes */
  function etaFor(p, rates) {
    if (!p.ok || !p.missing) return { weeks: 0, label: "ready", gate: null };
    var r = rates || RATES, byCat = {};
    p.asc.rows.concat(p.talent.rows).forEach(function (row) {
      if (!row.miss) return;
      byCat[row.cat] = (byCat[row.cat] || 0) + row.miss;
    });
    var worst = null;
    Object.keys(byCat).forEach(function (cat) {
      var w = weeksFor(byCat[cat], r[cat] === undefined ? 100 : r[cat]);
      if (!worst || w > worst.weeks) worst = { cat: cat, weeks: w, count: byCat[cat] };
    });
    return {
      weeks: worst ? worst.weeks : 0,
      gate: worst ? worst.cat : null,
      label: worst ? (worst.weeks < 0.2 ? "this week" : worst.weeks.toFixed(1).replace(/\.0$/, "") + " wks") : "ready"
    };
  }
  function bottleneckFor(p, rates) {
    var rows = p.asc.rows.concat(p.talent.rows).filter(function (r) { return r.miss > 0; });
    if (!rows.length) return null;
    var r = rates || RATES;
    rows.sort(function (a, b) {
      return weeksFor(b.miss, r[b.cat] === undefined ? 100 : r[b.cat]) - weeksFor(a.miss, r[a.cat] === undefined ? 100 : r[a.cat]);
    });
    return rows[0];
  }

  /* ---------- what can be farmed today ------------------------------------ */
  function bookSeriesOf(matName) { return seriesOf(matName); }
  function bookOpenOn(series, day) {
    var g = (DATA.bookDays || {})[series];
    if (!g) return true;
    if (day === 0) return true;              // Sunday: every talent domain is open
    return g.indexOf(day) >= 0;
  }
  /* days until a locked source next drops (0 = today) */
  function nextOpenDay(days, today) {
    for (var i = 0; i < 7; i++) if (days.indexOf((today + i) % 7) >= 0) return i;
    return 0;
  }
  function todayPlan(today) {
    var d = today === undefined ? new Date().getDay() : today;
    var out = { day: d, dayName: DAY_NAMES[d], books: [], weeklies: true, any: [] };
    (DATA.bookSeries || []).forEach(function (s) { if (bookOpenOn(s, d)) out.books.push(s); });
    return out;
  }

  /* ---------- consolidated shopping list over the whole watchlist --------- */
  function consolidate(plans) {
    var pool = {};
    plans.forEach(function (p) {
      if (!p || !p.ok) return;
      p.asc.rows.concat(p.talent.rows).forEach(function (r) {
        var e = pool[r.name];
        if (!e) e = pool[r.name] = { name: r.name, cat: r.cat, want: 0, have: 0, miss: 0, who: [] };
        e.want += r.want; e.have += r.have; e.miss += r.miss; e.who.push({ name: p.name, miss: r.miss, want: r.want, have: r.have });
      });
    });
    var rows = Object.keys(pool).map(function (k) {
      var e = pool[k];
      e.who.sort(function (a, b) { return b.miss - a.miss || a.name.localeCompare(b.name); });
      e.needers = e.who.filter(function (w) { return w.miss > 0; }).length;
      var series = e.cat === "book" ? bookSeriesOf(e.name) : null;
      var locked = series ? !bookOpenOn(series, todayPlan().day) : false;
      e.series = series;
      e.days = series ? (DATA.bookDays[series] || []) : (e.cat === "weekly" ? [DATA.weeklyResetDay || 1] : [0, 1, 2, 3, 4, 5, 6]);
      e.lockedToday = locked;
      return e;
    });
    rows.sort(function (a, b) {
      return b.miss - a.miss || (b.needers - a.needers) || a.name.localeCompare(b.name);
    });
    return rows;
  }

  /* ---------- account-level roll-up -------------------------------------- */
  function aggregate(plans, rates) {
    var r = rates || RATES;
    var ready = 0, done = 0, missing = 0, mora = 0, crowns = 0, pctSum = 0;
    var byCat = {};
    var weeks = [];
    plans.forEach(function (p) {
      if (!p || !p.ok) return;
      if (!p.missing) done++;
      if (p.next.ready) ready++;
      missing += p.missing; mora += p.mora; crowns += p.crowns; pctSum += p.pct;
      var c = {};
      p.asc.rows.concat(p.talent.rows).forEach(function (row) { if (row.miss) c[row.cat] = (c[row.cat] || 0) + row.miss; });
      Object.keys(c).forEach(function (k) { byCat[k] = (byCat[k] || 0) + c[k]; });
      weeks.push(etaFor(p, r).weeks);
    });
    var gate = null;
    Object.keys(byCat).forEach(function (k) {
      var w = weeksFor(byCat[k], r[k] === undefined ? 100 : r[k]);
      if (!gate || w > gate.weeks) gate = { cat: k, weeks: w, count: byCat[k] };
    });
    /* account-wide: the slowest single-source chain across everyone tracked */
    var poolWeeks = 0;
    consolidate(plans).forEach(function (e) {
      if (!e.miss) return;
      var w = weeksFor(e.miss, r[e.cat] === undefined ? 100 : r[e.cat]);
      if (w > poolWeeks) poolWeeks = w;
    });
    return {
      n: plans.length, done: done, readyToAscend: ready, missing: missing, mora: mora, crowns: crowns,
      avgPct: plans.length ? Math.round(pctSum / plans.length) : 0,
      worstCharacterWeeks: weeks.length ? Math.max.apply(null, weeks) : 0,
      poolWeeks: Math.round(poolWeeks * 10) / 10,
      gate: gate, byCat: byCat
    };
  }

  /* ---------- status, for filters and colouring -------------------------- */
  function statusOf(p) {
    if (!p || !p.ok) return "unknown";
    if (!p.touched) return "new";
    if (!p.missing && p.fullyAscended && p.tal.every(function (t) { return t >= TALENT_MAX; })) return "complete";
    if (p.next.ready) return "ready";
    return "progress";
  }
  var STATUS_LABEL = { new: "Not started", progress: "In progress", ready: "Can ascend now", complete: "Build complete", unknown: "No data" };

  /* ---------- storage (safe when localStorage is blocked) ---------------- */
  function makeStore(key, fallback) {
    var mem = null, blocked = false;
    function read() {
      if (mem) return mem;
      try {
        var raw = localStorage.getItem(key);
        mem = raw ? JSON.parse(raw) : null;
      } catch (e) { blocked = true; mem = null; }
      if (!mem) mem = JSON.parse(JSON.stringify(fallback));
      return mem;
    }
    return {
      isBlocked: function () { return blocked; },
      get data() { return read(); },
      save: function () { try { localStorage.setItem(key, JSON.stringify(read())); } catch (e) { blocked = true; } },
      mutate: function (fn) { fn(read()); this.save(); return read(); }
    };
  }

  var WATCH_KEY = "irminsul:watchlist:v2";
  var EMPTY_WATCH = { chars: {}, owned: [], rates: RATES, sort: "priority", view: "cards", notes: {} };

  function openWatch() {
    var store = makeStore(WATCH_KEY, EMPTY_WATCH);
    var d = store.data;
    if (!d.chars) d.chars = {};
    if (!d.owned) d.owned = [];
    if (!d.rates) d.rates = JSON.parse(JSON.stringify(RATES));
    return { store: store, data: d };
  }

  /* migrate the v1 shape the old builder modal used: { "Mitya": {lvl, tal, have} } */
  function migrateLegacy() {
    try {
      var raw = localStorage.getItem("irminsul:tracker");
      if (!raw) return null;
      var old = JSON.parse(raw) || {};
      var moved = 0, w = openWatch();
      Object.keys(old).forEach(function (n) {
        if (!BY_NAME[n] || w.data.chars[n]) return;
        var s = old[n] || {};
        w.data.chars[n] = { lvl: s.lvl || 1, tal: s.tal || [1, 1, 1], have: s.have || {}, prio: 0 };
        moved++;
      });
      if (moved) w.store.save();
      return moved;
    } catch (e) { return null; }
  }

  function emptyState() { return { lvl: 1, tal: [1, 1, 1], have: {}, prio: 0, note: "" }; }

  function prioLabel(p) { return ["", "Main", "Alt", "Someday"][clamp(p, 0, 3)] || ""; }

  function byName(n) { return BY_NAME[n]; }
  function allChars() { return CHARS; }
  function data() { return DATA; }
  function dayNames() { return DAY_NAMES; }

  return {
    CAPS: CAPS, RATES: RATES, MAT_LABEL: MAT_LABEL, DAY_NAMES: DAY_NAMES, TAL_CURVE: TAL_CURVE,
    STATUS_LABEL: STATUS_LABEL, WATCH_KEY: WATCH_KEY,
    plan: plan, consolidate: consolidate, aggregate: aggregate, statusOf: statusOf,
    weeksFor: weeksFor, etaFor: etaFor, ascStage: ascStage, collected: collected,
    bookOpenOn: bookOpenOn, bookSeriesOf: bookSeriesOf, nextOpenDay: nextOpenDay, todayPlan: todayPlan,
    talStepsFor: talStepsFor, namesFor: namesFor, seriesOf: seriesOf,
    ascPhasesFor: ascPhasesFor, isGenericRow: isGenericRow,
    openWatch: openWatch, migrateLegacy: migrateLegacy, emptyState: emptyState,
    prioLabel: prioLabel, byName: byName, allChars: allChars, data: data, dayNames: dayNames,
    fmtMora: function (n) { return n == null ? "" : Number(n).toLocaleString("en-US"); },
    fmtWeeks: function (w) { return !w ? "—" : w < 1 ? "this week" : (Math.round(w * 10) / 10) + " wk" + (w >= 2 ? "s" : ""); }
  };
});

/* ==========================================================================
   Tracking Center page logic.
   Left = choose who to monitor. Right = monitor them. Below = what the whole
   watchlist still needs, merged, and when you can actually farm it.
   ========================================================================== */
(function () {
  "use strict";
  var UI = window.UI, F = UI.F, D = UI.D;
  var esc = UI.esc;

  var pick = { q: "", el: "all", r: "all", cat: "all", ownedOnly: false, trackedOnly: false };
  var ui = { expanded: false, shopTab: "all", hideDone: true };
  var statsOpen = {};                          /* which cards have "Stat targets" open — survives re-renders */
  var watch = UI.watch();

  /* ---------- little bits ---------- */
  function statusBadge(p) {
    var s = F.statusOf(p);
    var cls = s === "complete" ? "good" : s === "ready" ? "gold" : s === "progress" ? "ice" : "";
    return '<span class="badge ' + cls + '">' + esc(F.STATUS_LABEL[s] || s) + "</span>";
  }
  function prioSelect(p) {
    var cur = watch.chars[p.name] ? (watch.chars[p.name].prio || 0) : 0;
    return '<select data-act="prio" data-name="' + esc(p.name) + '" aria-label="Priority for ' + esc(p.name) + '" style="font-size:11.5px;padding:3px 5px;border-radius:7px">' +
      [0, 1, 2, 3].map(function (v) {
        return '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + (v ? F.prioLabel(v) : "no priority") + "</option>";
      }).join("") + "</select>";
  }
  function dayListFor(d, pool) {
    return pool.filter(function (e) {
      return e.miss > 0 && e.cat === "book" && e.series && F.bookOpenOn(e.series, d);
    });
  }

  /* ================= 1. the picker: choose who to track ================= */
  function rosterFiltered() {
    var q = pick.q.toLowerCase();
    return D.chars.filter(function (c) {
      if (pick.el !== "all" && c.e !== pick.el) return false;
      if (pick.r !== "all" && String(c.r) !== pick.r) return false;
      if (pick.cat !== "all" && c.cat !== pick.cat) return false;
      if (pick.ownedOnly && !UI.isOwned(c.n)) return false;
      if (pick.trackedOnly && !UI.isTracked(c.n)) return false;
      if (q && (c.n + " " + c.e + " " + c.w + " " + (c.role || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderChips() {
    var els = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"];
    UI.$("#elChips").innerHTML = ['<button class="chip" data-f="el" data-v="all" aria-pressed="' + (pick.el === "all") + '">All elements</button>']
      .concat(els.map(function (e) {
        return '<button class="chip" data-f="el" data-v="' + e + '" aria-pressed="' + (pick.el === e) + '" style="' +
          (pick.el === e ? "" : "color:" + UI.elColor(e)) + '">' + esc(D.elGlyph[e] || "") + " " + e + "</button>";
      })).join("");
    UI.$("#miscChips").innerHTML =
      '<button class="chip" data-f="r" data-v="all" aria-pressed="' + (pick.r === "all") + '">Any ★</button>' +
      '<button class="chip" data-f="r" data-v="5" aria-pressed="' + (pick.r === "5") + '">5★</button>' +
      '<button class="chip" data-f="r" data-v="4" aria-pressed="' + (pick.r === "4") + '">4★</button>' +
      '<button class="chip" data-f="cat" data-v="dps" aria-pressed="' + (pick.cat === "dps") + '">DPS</button>' +
      '<button class="chip" data-f="cat" data-v="sub" aria-pressed="' + (pick.cat === "sub") + '">Sub-DPS</button>' +
      '<button class="chip" data-f="cat" data-v="support" aria-pressed="' + (pick.cat === "support") + '">Support</button>' +
      '<button class="chip" data-f="cat" data-v="sustain" aria-pressed="' + (pick.cat === "sustain") + '">Sustain</button>' +
      '<button class="chip" data-f="ownedOnly" aria-pressed="' + pick.ownedOnly + '">Owned only <span class="n">' + (watch.owned || []).length + "</span></button>" +
      '<button class="chip" data-f="trackedOnly" aria-pressed="' + pick.trackedOnly + '">Tracked only</button>';
  }
  function renderPicker() {
    var rows = rosterFiltered();
    UI.$("#pickCount").textContent = "(" + rows.length + ")";
    UI.$("#pickList").innerHTML = rows.map(function (c) {
      var on = UI.isTracked(c.n);
      var p = on ? UI.planOf(c.n) : null;
      var st = p ? F.statusOf(p) : null;
      var pctLine = p ? '<span class="mini-pct">' + (p.pct) + "% · " + (p.missing ? p.missing + " owed" : "done") + "</span>" :
        '<span class="mini-pct dim">' + (UI.isOwned(c.n) ? "owned" : "—") + "</span>";
      return '<button class="pickrow' + (on ? " on" : "") + '" data-act="toggle" data-name="' + esc(c.n) + '" aria-pressed="' + on + '">' +
        UI.avatar(c.n, 30) +
        '<span class="grow"><span class="nm">' + esc(c.n) + "</span>" +
        '<span class="sub">' + esc(D.elGlyph[c.e] || "") + " " + c.r + "★ · " + esc(c.w) + "</span></span>" +
        pctLine +
        '<input type="checkbox"' + (on ? " checked" : "") + ' tabindex="-1" aria-hidden="true" style="pointer-events:none">' +
        "</button>";
    }).join("") || '<p class="dim" style="padding:12px;font-size:13px">No character matches those filters.</p>';
    var n = UI.tracked().length;
    UI.$("#trackedBadge").textContent = n + " tracked";
  }

  /* ================= 2. the watchlist ================= */
  function visiblePlans() {
    var which = UI.$("#statusFilter").value;
    var all = UI.plans();
    var rows = all.filter(function (p) {
      var s = F.statusOf(p);
      if (which === "all") return true;
      if (which === "gate") return p.eta.gate === "weekly" && p.missing > 0;
      return s === which;
    });
    var key = UI.sortKey();
    rows.sort(function (a, b) {
      var pa = (watch.chars[a.name] || {}).prio || 0, pb = (watch.chars[b.name] || {}).prio || 0;
      if (key === "priority") return (pb - pa) || (a.missing - b.missing) || a.name.localeCompare(b.name);
      if (key === "missing") return (b.missing - a.missing) || a.name.localeCompare(b.name);
      if (key === "pct") return (b.pct - a.pct) || a.name.localeCompare(b.name);
      if (key === "eta") return (b.eta.weeks - a.eta.weeks) || (b.missing - a.missing);
      if (key === "level") return (b.lvl - a.lvl) || (b.missing - a.missing);
      return a.name.localeCompare(b.name);
    });
    return rows;
  }
  function matRow(p, r) {
    var done = r.miss === 0;
    return '<li class="mrow' + (done ? " done" : "") + '" data-mat="' + esc(r.name) + '" style="--catc:' + UI.catColor(r.cat) + '">' +
      UI.matIcon(r.name, r.cat, 22) +
      '<span class="nm">' + esc(r.name) + ' <i>' + esc(F.MAT_LABEL[r.cat] || r.cat) + "</i></span>" +
      '<span class="need">need ' + r.want + "</span>" +
      '<span class="stepper"><button data-act="mat" data-name="' + esc(p.name) + '" data-mat="' + esc(r.name) + '" data-d="-1" aria-label="one less">−</button>' +
      '<input type="number" min="0" step="1" inputmode="numeric" value="' + r.have + '" data-act="matin" data-name="' + esc(p.name) + '" data-mat="' + esc(r.name) + '" aria-label="' + esc(r.name) + ' owned">' +
      '<button data-act="mat" data-name="' + esc(p.name) + '" data-mat="' + esc(r.name) + '" data-d="1" aria-label="one more">＋</button></span>' +
      '<span class="gap ' + (done ? "ok" : "no") + '">' + (done ? "✓" : "−" + r.miss) + "</span>" +
      "</li>";
  }
  /* "Stat targets" fold-out on a watch card (needs guide.js). It has to stay BELOW the
     materials <details>: patchLive() looks up the first "details.more summary span". */
  function statsHTML(name) {
    var sum = UI.statSummary ? UI.statSummary(name) : "";
    if (!sum) return "";
    return '<details class="more" data-statsfor="' + esc(name) + '"' + (statsOpen[name] ? " open" : "") + ">" +
      '<summary>Stat targets <span class="dim">(<span data-statsum="' + esc(name) + '">' + esc(sum) + "</span>)</span></summary>" +
      UI.statBlock(name, { mains: true, legend: "short" }) + "</details>";
  }
  function cardHTML(p) {
    var c = F.byName(p.name);
    var s = F.statusOf(p);
    var nextPills = p.next.rows.length ? p.next.rows.map(function (r) {
      return '<span class="pill' + (r.miss === 0 ? " ok" : "") + '">' + UI.matIcon(r.name, r.cat, 16) + " " + esc(r.name) +
        ' <b class="mono">' + r.have + "/" + r.want + "</b></span>";
    }).join("") : '<span class="dim" style="font-size:12px">Fully ascended — nothing left to gather.</span>';

    return '<article class="wcard ' + (s === "complete" ? "complete" : s === "ready" ? "ready" : s === "new" ? "newone" : "") + '" id="wc-' + esc(slugKey(p.name)) + '" data-name="' + esc(p.name) + '">' +
      '<div class="hd">' + UI.avatar(p.name, 46) +
      '<div class="who"><h3>' + esc(p.name) + " " + UI.stars(c.r) + "</h3>" +
      '<div class="sub">' + UI.elTag(c) + ' <span class="dim">·</span> ' + esc(c.w) + " <span class=\"dim\">·</span> " + esc(c.role || "") + "</div>" +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;align-items:center">' + statusBadge(p) +
      (s === "progress" || s === "new" || s === "ready" ? '<span class="badge plain">' + esc(F.fmtWeeks(p.eta.weeks)) + "</span>" : "") +
      (c.ver === "7.2" ? '<span class="badge gold">new 7.2</span>' : "") +
      "</div></div>" +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' + prioSelect(p) +
      '<button class="xbtn" data-act="untrack" data-name="' + esc(p.name) + '" title="Stop tracking (keeps nothing)">✕</button></div>' +
      "</div>" +

      '<div class="lvrow"><input type="range" min="1" max="90" step="1" value="' + p.lvl + '" data-act="lvl" data-name="' + esc(p.name) + '" aria-label="Level">' +
      '<span class="lvnum"><input type="number" min="1" max="90" value="' + p.lvl + '" data-act="lvlnum" data-name="' + esc(p.name) + '" aria-label="Level number">' +
      '<span class="dim mono" style="font-size:11.5px">/' + p.levelCap + "</span></span></div>" +

      '<div class="tals">' + ["Normal", "Skill", "Burst"].map(function (t, i) {
        return '<div class="tal"><span>' + t + '</span><span class="stepper">' +
          '<button data-act="tal" data-i="' + i + '" data-d="-1" data-name="' + esc(p.name) + '" aria-label="one less">−</button>' +
          '<input type="number" min="1" max="10" value="' + p.tal[i] + '" data-act="talin" data-i="' + i + '" data-name="' + esc(p.name) + '" aria-label="' + t + ' talent level">' +
          '<button data-act="tal" data-i="' + i + '" data-d="1" data-name="' + esc(p.name) + '" aria-label="one more">＋</button></span></div>';
      }).join("") + "</div>" +

      '<div class="live" data-live>' + liveHTML(p) + "</div>" +

      '<details class="more"' + (ui.expanded ? " open" : "") + "><summary>Materials &amp; next ascension <span class=\"dim\">(" + (p.missing) + " owed)</span></summary>" +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">' + nextPills + "</div>" +
      '<ul class="mats" data-live2>' + p.asc.rows.map(function (r) { return matRow(p, r); }).join("") +
      (p.talent.rows.length ? '<li class="rowline" style="padding:6px 2px 0;color:var(--ice)">Talent books &amp; weekly</li>' + p.talent.rows.map(function (r) { return matRow(p, r); }).join("") : "") +
      "</ul></details>" +
      statsHTML(p.name) +

      '<div class="foot"><div class="acts">' +
      '<button class="btn xs" data-act="quick" data-do="cap" data-name="' + esc(p.name) + '">Level → ' + p.levelCap + "</button>" +
      '<button class="btn xs" data-act="quick" data-do="tal10" data-name="' + esc(p.name) + '">Talents → 10</button>' +
      '<button class="btn xs" data-act="quick" data-do="fill" data-name="' + esc(p.name) + '">Mark all collected</button>' +
      '<button class="btn xs danger" data-act="quick" data-do="reset" data-name="' + esc(p.name) + '">Reset</button>' +
      "</div>" +
      '<a class="btn xs ghost" href="index.html?c=' + encodeURIComponent(slugKey(p.name)) + '" title="Open this character\'s build page">Build ↗</a>' +
      "</div>" +
      "</article>";
  }
  function slugKey(n) { return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

  function liveHTML(p) {
    var s = F.statusOf(p);
    return '<div style="display:flex;gap:11px;align-items:center">' + UI.ring(p.pct, s) +
      '<div class="bars" style="flex:1 1 auto">' +
      '<div><div class="barlabel"><span>Ascension <span class="dim">' + p.asc.miss + "/" + p.asc.want + "</span></span><b>" + p.asc.pct + "%</b></div>" + UI.bar(p.asc.pct) + "</div>" +
      '<div><div class="barlabel"><span>Talents <span class="dim">' + p.talent.miss + "/" + p.talent.want + "</span></span><b>" + p.talent.pct + "%</b></div>" + UI.bar(p.talent.pct) + "</div>" +
      "</div></div>" +
      '<div class="kv" style="margin-top:9px">' +
      '<div><span>Still missing</span><b>' + p.missing + "</b></div>" +
      '<div><span>Next ascension</span><b>' + (p.next.rows.length ? (p.next.miss === 0 ? "ready ✓" : p.next.miss + " left") : "maxed") + "</b></div>" +
      '<div><span>Mora</span><b>' + F.fmtMora(p.mora) + "</b></div>" +
      '<div><span>Crowns</span><b>' + (p.crowns ? p.crowns + " owed" : "—") + "</b></div>" +
      "</div>" +
      '<div class="rowline" style="margin-top:8px;align-items:center;gap:8px"><span style="min-width:0">' + gateTxt(p) + "</span>" + openNoteFor(p) + "</div>" +
      (p.generic ? '<p class="dim" style="margin:6px 0 0;font-size:11.5px">Generic 5★ totals — this character\'s materials follow the element you are attuned to.</p>' : "");
  }
  /* gateTxt/openNote get their own helpers so liveHTML stays re-renderable alone */
  function gateTxt(p) {
    if (!p.missing) return "Everything for this build is banked";
    if (!p.bottleneck) return p.missing + " items owed";
    return "<b>" + esc(p.bottleneck.name) + "</b> is the gate · " + esc(F.MAT_LABEL[p.bottleneck.cat] || "") + " · " + esc(F.fmtWeeks(p.eta.weeks));
  }
  function openNoteFor(p) {
    var b = p.bottleneck;
    if (!b) return "";
    if (b.cat === "book") {
      var days = (D.bookDays[F.bookSeriesOf(b.name)] || []);
      return '<span class="badge plain ice">domain ' + days.map(function (d) { return F.DAY_NAMES[d]; }).join(" / ") + " + Sun</span>";
    }
    if (b.cat === "weekly") return '<span class="badge plain bad">1 drop / week</span>';
    return "";
  }

  function renderWatch() {
    var box = UI.$("#watch");
    var rows = visiblePlans();
    if (!UI.tracked().length) {
      box.innerHTML = '<div class="empty"><h3>Nothing tracked yet</h3><p>Tick anyone in the list on the left — a character you own, ' +
        "the 7.2 banner kids, whoever you are building. Their card appears here with level, talents and exactly what they still owe.</p>" +
        '<p style="margin-top:12px"><button class="btn gold" data-bulk="new">＋ Track everyone new in 7.2</button></p></div>';
      return;
    }
    if (!rows.length) {
      box.innerHTML = '<div class="empty"><h3>No tracked character matches that filter</h3><p>Switch the “Show” filter back to <i>Everyone tracked</i>.</p></div>';
      return;
    }
    if (UI.view() === "table") { box.innerHTML = tableHTML(rows); return; }
    box.innerHTML = '<div class="wcards">' + rows.map(cardHTML).join("") + "</div>";
  }
  function tableHTML(rows) {
    return '<div class="scrollx"><table class="tbl"><thead><tr>' +
      "<th>Character</th><th>Lvl</th><th>Talents</th><th>Asc</th><th>Tal</th><th class=\"num\">Missing</th>" +
      "<th class=\"num\">Mora</th><th>Gate</th><th class=\"num\">ETA</th><th>Status</th>" +
      "</tr></thead><tbody>" +
      rows.map(function (p) {
        var c = F.byName(p.name);
        return '<tr data-act="jump" data-name="' + esc(p.name) + '">' +
          '<td><span class="who">' + UI.avatar(p.name, 26) + " " + esc(p.name) + "</span></td>" +
          '<td class="mono">' + p.lvl + '<span class="dim">/' + p.levelCap + "</span></td>" +
          '<td class="mono">' + p.tal.join("·") + "</td>" +
          "<td>" + UI.bar(p.asc.pct) + "</td>" +
          "<td>" + UI.bar(p.talent.pct) + "</td>" +
          '<td class="num">' + p.missing + "</td>" +
          '<td class="num">' + F.fmtMora(p.mora) + "</td>" +
          "<td>" + (p.bottleneck ? esc(p.bottleneck.name) : "—") + "</td>" +
          '<td class="num">' + esc(F.fmtWeeks(p.eta.weeks)) + "</td>" +
          "<td>" + statusBadge(p) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="dim" style="font-size:12px;margin-top:9px">Click any row to open its card and edit it.</p>';
  }

  /* ================= 3. summary strip ================= */
  function renderStats() {
    var plans = UI.plans();
    var a = F.aggregate(plans, UI.rates());
    var pool = F.consolidate(plans).filter(function (e) { return e.miss > 0; });
    var today = F.todayPlan();
    var openToday = pool.filter(function (e) { return !e.lockedToday; });
    var tiles = [
      { k: "Tracked", v: a.n, s: UI.tracked().length ? (watch.owned && watch.owned.length ? (watch.owned.length + " owned on account") : "") : "tick names on the left", c: "gold" },
      { k: "Average readiness", v: a.avgPct + "%", s: a.done + " finished · " + a.readyToAscend + " can ascend now", c: "ice" },
      { k: "Items still owed", v: a.missing, s: pool.length + " different materials", c: a.missing ? "warn" : "good" },
      { k: "Open today (" + today.dayName + ")", v: openToday.length ? openToday.reduce(function (x, e) { return x + e.miss; }, 0) : 0, s: openToday.length ? "go farm " + openToday.slice(0, 2).map(function (e) { return e.name; }).join(", ") : "today's domains are shut", c: openToday.length ? "good" : "" },
      { k: "Mora owed", v: a.mora > 999999 ? (a.mora / 1000000).toFixed(2) + "M" : F.fmtMora(a.mora), s: "ascension + talent costs", c: "" },
      { k: "Longest chain", v: F.fmtWeeks(a.poolWeeks || a.worstCharacterWeeks), s: a.gate ? "gated by " + (F.MAT_LABEL[a.gate.cat] || a.gate.cat).toLowerCase() : "nothing pending", c: a.poolWeeks > 3 ? "bad" : "" }
    ];
    UI.$("#stats").innerHTML = tiles.map(function (t) {
      return '<div class="stat ' + (t.c || "") + '"><i></i><b>' + t.v + "</b><span>" + esc(t.k) + "</span>" +
        (t.s ? "<small>" + esc(t.s) + "</small>" : "") + "</div>";
    }).join("");
  }

  /* ================= 4. week strip ================= */
  function renderFarm() {
    var plans = UI.plans();
    var pool = F.consolidate(plans).filter(function (e) { return e.miss > 0; });
    var today = new Date().getDay();
    UI.$("#todayBadge").textContent = "Today is " + F.DAY_NAMES[today];
    var others = { specialty: 0, boss: 0, mob: 0, gem: 0, crown: 0 };
    pool.forEach(function (e) { if (others[e.cat] !== undefined) others[e.cat] += e.miss; });
    UI.$("#days").innerHTML = F.DAY_NAMES.map(function (nm, d) {
      var rows = dayListFor(d, pool);
      var bySeries = {};
      rows.forEach(function (e) {
        var k = e.series;
        bySeries[k] = bySeries[k] || { miss: 0, who: {} };
        bySeries[k].miss += e.miss;
        e.who.forEach(function (w) { if (w.miss) bySeries[k].who[w.name] = 1; });
      });
      var keys = Object.keys(bySeries).sort(function (a, b) { return bySeries[b].miss - bySeries[a].miss; });
      var weeklyLine = d === (D.weeklyResetDay || 1);
      return '<div class="day' + (d === today ? " today" : "") + '"><h4><span>' + nm + "</span>" +
        (d === today ? '<span class="badge gold">today</span>' : "") + "</h4>" +
        (keys.length ? '<ul>' + keys.slice(0, 3).map(function (k) {
          return "<li><b>" + bySeries[k].miss + "</b> × " + esc(k) + " <span class=\"dim\">(" + Object.keys(bySeries[k].who).length + ")</span></li>";
        }).join("") + (keys.length > 3 ? '<li class="dim">+' + (keys.length - 3) + " more series</li>" : "") + "</ul>"
          : '<p class="none">no talent books owed</p>') +
        (weeklyLine ? '<p class="none" style="color:var(--gold)">weekly boss loot resets</p>' : "") +
        "</div>";
    }).join("");
    var anyDay = Object.keys(others).reduce(function (a, k) { return a + others[k]; }, 0);
    var openNow = dayListFor(today, pool);
    var weeklies = pool.filter(function (e) { return e.cat === "weekly"; });
    UI.$("#farmNote").innerHTML = "<b>" + (openNow.length ? "Today (" + F.DAY_NAMES[today] + ") is a good day: " : "Today (" + F.DAY_NAMES[today] + ") has no matching talent domain — ") +
      (openNow.length ? openNow.slice(0, 3).map(function (e) { return esc(e.name) + " <span class='mono'>×" + e.miss + "</span>"; }).join(", ") + "." : "nothing book-shaped to farm.") + "</b> " +
      (weeklies.length ? "Weekly bosses never day-lock: " + weeklies.length + " weekly drop" + (weeklies.length > 1 ? "s are" : " is") + " still owed, 1 per boss per week. " : "") +
      (anyDay ? "Everything else — gems, specialties, enemy drops, " + anyDay + " items — can be farmed any day." : "");
  }

  /* ================= 5. combined shopping list ================= */
  function shopPool() {
    var pool = F.consolidate(UI.plans());
    /* the Banked tab is explicitly about finished rows, so it ignores the
       "hide what is banked" toggle */
    if (ui.hideDone && ui.shopTab !== "done") pool = pool.filter(function (e) { return e.miss > 0; });
    if (ui.shopTab === "today") pool = pool.filter(function (e) { return e.miss > 0 && !e.lockedToday; });
    else if (ui.shopTab === "locked") pool = pool.filter(function (e) { return e.miss > 0 && e.lockedToday; });
    else if (ui.shopTab === "weekly") pool = pool.filter(function (e) { return e.cat === "weekly" || e.cat === "crown"; });
    else if (ui.shopTab === "done") pool = pool.filter(function (e) { return e.miss === 0; });
    return pool;
  }
  function renderShop() {
    var tabs = [["all", "Everything"], ["today", "Open today"], ["locked", "Day-locked"], ["weekly", "Weekly & crowns"], ["done", "Banked"]];
    var poolAll = F.consolidate(UI.plans());
    UI.$("#shopTabs").innerHTML = tabs.map(function (t) {
      var n = t[0] === "all" ? poolAll.filter(function (e) { return e.miss > 0; }).length
        : t[0] === "done" ? poolAll.filter(function (e) { return e.miss === 0; }).length
        : t[0] === "weekly" ? poolAll.filter(function (e) { return (e.cat === "weekly" || e.cat === "crown") && e.miss > 0; }).length
        : poolAll.filter(function (e) { return e.miss > 0 && (t[0] === "today" ? !e.lockedToday : e.lockedToday); }).length;
      return '<button class="chip" data-shop="' + t[0] + '" aria-pressed="' + (ui.shopTab === t[0]) + '">' + t[1] + ' <span class="n">' + n + "</span></button>";
    }).join("") + '<label class="chip" style="cursor:pointer"><input type="checkbox" id="hideDone"' + (ui.hideDone ? " checked" : "") +
      ' style="accent-color:var(--gold);margin:0;width:13px;height:13px"> hide what is banked</label>';

    var pool = shopPool();
    var r = UI.rates();
    var slowest = pool.reduce(function (mx, e) {
      return Math.max(mx, F.weeksFor(e.miss, r[e.cat] === undefined ? 100 : r[e.cat]));
    }, 0);
    UI.$("#shopSub").innerHTML = pool.length
      ? pool.reduce(function (a, e) { return a + e.miss; }, 0) + " items · " + pool.length + " sources · slowest " + F.fmtWeeks(slowest)
      : "nothing owed";
    if (!UI.tracked().length) {
      UI.$("#shopBody").innerHTML = '<p class="dim" style="font-size:13px">Track a few characters and their material needs merge into one list here — shared drops are counted once, not once per character.</p>';
      return;
    }
    if (!pool.length) {
      UI.$("#shopBody").innerHTML = '<p class="dim" style="font-size:13px">' + (ui.hideDone ? "No outstanding materials — everything your watchlist needs is banked." : "Nothing to show.") + "</p>";
      return;
    }
    UI.$("#shopBody").innerHTML = '<div class="shop">' + pool.map(function (e) {
      var weeks = F.weeksFor(e.miss, r[e.cat] === undefined ? 100 : r[e.cat]);
      var lock = e.lockedToday ? '<span class="badge plain warn">next ' + nextOpen(e) + "</span>" : '<span class="badge plain good">open today</span>';
      return '<div class="shopitem"><span>' + UI.matIcon(e.name, e.cat, 24) + "</span>" +
        '<span><span class="nm">' + esc(e.name) + "</span>" +
        '<span class="meta">' + esc(F.MAT_LABEL[e.cat] || e.cat) + " · need <b class=\"mono\">" + e.want + "</b> · banked <b class=\"mono\">" + e.have + "</b>" +
        (e.needers > 1 ? ' · shared by <b class="mono">' + e.needers + "</b> of yours" : "") + "</span></span>" +
        '<span class="right"><span class="big" style="color:' + (e.miss ? "var(--warn)" : "var(--good)") + '">' + (e.miss ? "−" + e.miss : "✓") + "</span>" +
        '<span class="meta">' + lock + " <span class=\"badge plain\">" + F.fmtWeeks(weeks) + "</span></span></span>" +
        '<span class="whochips">' + e.who.map(function (w) {
          return '<button class="whochip' + (w.miss ? "" : " ok") + '" data-act="jump" data-name="' + esc(w.name) + '">' + esc(w.name) +
            " <b class=\"mono\">" + (w.miss ? w.have + "/" + w.want : "✓") + "</b></button>";
        }).join("") + "</span></div>";
    }).join("") + "</div>";
  }
  function nextOpen(e) {
    var today = new Date().getDay();
    var n = F.nextOpenDay(e.days, today);
    return n === 0 ? "today" : (n === 1 ? "tomorrow" : F.DAY_NAMES[(today + n) % 7]);
  }

  /* ================= render ================= */
  function renderAll() {
    renderChips(); renderPicker(); renderWatch(); renderStats(); renderFarm(); renderShop();
    UI.$("#sortBy").value = UI.sortKey();
    UI.syncNav();
  }
  /* light refresh after typing: keeps the cursor where it is */
  function refreshDerived() { renderPicker(); renderStats(); renderFarm(); renderShop(); UI.syncNav(); }
  function patchLive(name) {
    var card = UI.$("#wc-" + slugKey(name));
    if (!card) return;
    var live = card.querySelector("[data-live]");
    if (live) live.innerHTML = liveHTML(UI.planOf(name));
    var cnt = card.querySelector("details.more summary span");
    if (cnt) { var p = UI.planOf(name); cnt.textContent = "(" + p.missing + " owed)"; }
    var st = card.querySelector('.hd .badge');
    if (st) { var p2 = UI.planOf(name); st.outerHTML = statusBadge(p2); }
  }
  function patchMatRow(name, mat) {
    var card = UI.$("#wc-" + slugKey(name)); if (!card) return;
    var p = UI.planOf(name);
    var row = null;
    p.asc.rows.concat(p.talent.rows).forEach(function (r) { if (r.name === mat && !row) row = r; });
    if (!row) return;
    var li = card.querySelector('.mrow[data-mat="' + (window.CSS && CSS.escape ? CSS.escape(mat) : mat) + '"]');
    if (!li) return;
    var done = row.miss === 0;
    li.classList.toggle("done", done);
    li.querySelector(".need").textContent = "need " + row.want;
    li.querySelector(".gap").textContent = done ? "✓" : "−" + row.miss;
    li.querySelector(".gap").className = "gap " + (done ? "ok" : "no");
    var inp = li.querySelector("input");
    if (inp && document.activeElement !== inp) inp.value = row.have;
  }

  /* ================= events ================= */
  UI.$("#q").addEventListener("input", function () { pick.q = this.value.trim(); renderPicker(); });

  document.addEventListener("click", function (ev) {
    var chip = ev.target.closest("[data-f]");
    if (chip) {
      var f = chip.getAttribute("data-f"), v = chip.getAttribute("data-v");
      if (f === "ownedOnly" || f === "trackedOnly") pick[f] = !pick[f];
      else pick[f] = pick[f] === v ? "all" : v;
      renderChips(); renderPicker();
      return;
    }
    var tab = ev.target.closest("[data-shop]");
    if (tab) { ui.shopTab = tab.getAttribute("data-shop"); renderShop(); return; }
    var bulk = ev.target.closest("[data-bulk]");
    if (bulk) { doBulk(bulk.getAttribute("data-bulk")); return; }

    var b = ev.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    var name = b.getAttribute("data-name");
    var p = name ? UI.planOf(name) : null;

    if (act === "toggle") { UI.toggle(name); refreshDerived(); renderWatch(); flash(name); }
    else if (act === "untrack") { UI.remove(name); renderWatch(); refreshDerived(); UI.toast("Stopped tracking <b>" + UI.esc(name) + "</b>"); }
    else if (act === "jump") {
      UI.$("#vCards").click();
      var card = UI.$("#wc-" + slugKey(name));
      if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.style.outline = "1px solid var(--gold)"; setTimeout(function () { card.style.outline = ""; }, 1200); }
    }
    else if (act === "mat") {
      var d = Number(b.getAttribute("data-d"));
      var mat = b.getAttribute("data-mat");
      var have = Object.assign({}, UI.stateOf(name).have || {});
      have[mat] = Math.max(0, (Number(have[mat]) || 0) + d);
      UI.put(name, { have: have });
      patchMatRow(name, mat); patchLive(name); refreshDerived();
    }
    else if (act === "quick") { quick(name, b.getAttribute("data-do")); }
    else if (act === "tal") {
      var i = Number(b.getAttribute("data-i"));
      var cur = UI.stateOf(name).tal.slice();
      setTal(name, i, clampTal(cur[i] + Number(b.getAttribute("data-d"))));
      renderWatch(); refreshDerived();
    }
  });

  /* remember which "Stat targets" sections are open (toggle does not bubble, hence capture) */
  document.addEventListener("toggle", function (ev) {
    var d = ev.target, n = d && d.getAttribute && d.getAttribute("data-statsfor");
    if (n) statsOpen[n] = !!d.open;
  }, true);

  /* live typing in number/range inputs */
  document.addEventListener("input", function (ev) {
    var el = ev.target;
    var act = el.getAttribute && el.getAttribute("data-act");
    if (!act) return;
    var name = el.getAttribute("data-name");
    if (act === "lvl") { UI.put(name, { lvl: Math.max(1, Math.min(90, Number(el.value) || 1)) }); syncNum(name, "lvlnum", el.value); patchLive(name); refreshDerived(); }
    else if (act === "lvlnum") { UI.put(name, { lvl: Math.max(1, Math.min(90, Number(el.value) || 1)) }); syncNum(name, "lvl", el.value); patchLive(name); refreshDerived(); }
    else if (act === "talin") { setTal(name, Number(el.getAttribute("data-i")), el.value, false); }
    else if (act === "matin") {
      var mat = el.getAttribute("data-mat");
      var have = Object.assign({}, UI.stateOf(name).have || {});
      var v = Math.max(0, Math.floor(Number(el.value) || 0));
      if (v) have[mat] = v; else delete have[mat];
      UI.put(name, { have: have });
      patchMatRow(name, mat); patchLive(name); refreshDerived();
    }
  });
  function syncNum(name, act, val) {
    var card = UI.$("#wc-" + slugKey(name)); if (!card) return;
    var other = card.querySelector('[data-act="' + act + '"]');
    if (other && other !== document.activeElement) other.value = val;
  }
  document.addEventListener("change", function (ev) {
    var el = ev.target;
    if (!el.getAttribute) return;
    var act = el.getAttribute("data-act");
    if (act === "prio") { UI.put(el.getAttribute("data-name"), { prio: Number(el.value) || 0 }); renderWatch(); refreshDerived(); }
    else if (act === "lvl" || act === "lvlnum" || act === "talin" || act === "matin") { renderWatch(); refreshDerived(); }
  });
  function clampTal(v) { return Math.max(1, Math.min(10, Number(v) || 1)); }
  function setTal(name, i, val) {
    var t = UI.stateOf(name).tal.slice();
    t[i] = clampTal(val);
    UI.put(name, { tal: t });
    patchLive(name); refreshDerived();
  }

  function quick(name, what) {
    if (what === "cap") { UI.put(name, { lvl: UI.planOf(name).levelCap }); }
    else if (what === "tal10") { UI.put(name, { tal: [10, 10, 10] }); }
    else if (what === "fill") {
      var p = UI.planOf(name), have = Object.assign({}, UI.stateOf(name).have || {});
      p.asc.rows.concat(p.talent.rows).forEach(function (r) { have[r.name] = Math.max(have[r.name] || 0, r.want); });
      UI.put(name, { have: have });
      UI.toast("<b>" + esc(name) + "</b> — all remaining materials marked collected");
    } else if (what === "reset") { watch.chars[name] = F.emptyState(); UI.changed(); UI.toast("Reset <b>" + esc(name) + "</b>", "warn"); }
    renderWatch(); refreshDerived();
  }
  function doBulk(what) {
    if (what === "owned") {
      var own = (watch.owned || []).filter(function (n) { return F.byName(n) && !UI.isTracked(n); });
      own.forEach(function (n) { UI.add(n); });
      UI.toast(own.length ? "Added " + own.length + " owned characters" : "No owned characters are untracked — use the ★ on roster cards", own.length ? "" : "warn");
    } else if (what === "new") {
      var feat = UI.featured();
      var added = feat.filter(function (n) { return !UI.isTracked(n); });
      added.forEach(function (n) { UI.add(n); });
      UI.toast(added.length ? "Tracking " + added.length + " of the 7.2 marquee characters" : "Already tracking all " + feat.length + " featured characters", added.length ? "" : "warn");
    } else if (what === "none") {
      var n = UI.tracked().length;
      watch.chars = {}; UI.changed();
      UI.toast(n ? "Cleared " + n + " tracked characters" : "Nothing was tracked", "warn");
    }
    renderAll();
  }
  function flash(name) {
    var card = UI.$("#wc-" + slugKey(name));
    if (card) { card.animate([{ boxShadow: "0 0 0 2px var(--good)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 700 }); }
  }

  /* toolbar controls */
  UI.$("#sortBy").addEventListener("change", function () { watch.sort = this.value; UI.changed(); renderWatch(); });
  UI.$("#statusFilter").addEventListener("change", renderWatch);
  UI.$("#vCards").addEventListener("click", function () { watch.view = "cards"; UI.changed(); setView(); renderWatch(); });
  UI.$("#vTable").addEventListener("click", function () { watch.view = "table"; UI.changed(); setView(); renderWatch(); });
  function setView() {
    UI.$("#vCards").setAttribute("aria-pressed", UI.view() === "cards");
    UI.$("#vTable").setAttribute("aria-pressed", UI.view() === "table");
  }
  UI.$("#btnExpand").addEventListener("click", function () { ui.expanded = true; renderWatch(); });
  UI.$("#btnCollapse").addEventListener("click", function () { ui.expanded = false; renderWatch(); });
  UI.$("#btnPrint").addEventListener("click", function () { window.print(); });
  UI.$("#shopTabs").addEventListener("change", function (ev) {
    if (ev.target.id === "hideDone") { ui.hideDone = ev.target.checked; renderShop(); }
  });
  UI.$("#btnQuickAdd").addEventListener("click", function () {
    var from = new URLSearchParams(location.search).get("t");
    if (from) {
      from.split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (n) { if (F.byName(n)) UI.add(n); });
      UI.toast("Tracking your team from the share link");
    } else {
      D.chars.filter(function (c) { return c.ver === "7.2"; }).slice(0, 4).forEach(function (c) { UI.add(c.n); });
      UI.toast("Added the 7.2 headline characters — tick more on the left");
    }
    renderAll();
  });

  /* settings: farm rates */
  function renderRates() {
    var r = UI.rates();
    UI.$("#rates").innerHTML = '<div class="kv" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      Object.keys(F.RATES).map(function (k) {
        return '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start"><span>' + esc(F.MAT_LABEL[k] || k) + "</span>" +
          '<span class="stepper" style="width:100%"><button data-rate="' + k + '" data-d="-1">−</button>' +
          '<input type="number" min="0" step="1" value="' + r[k] + '" data-rate="' + k + '" style="width:100%">' +
          '<button data-rate="' + k + '" data-d="1">＋</button></span>' +
          '<span class="dim" style="font-size:11px">per week</span></div>';
      }).join("") + "</div>" +
      '<p class="dim" style="font-size:12.5px">Books assume ~12 domain runs on each of the three domain days. Weekly boss is one drop per boss per week, which is why two characters wanting the same weekly material take two weeks.</p>';
  }
  UI.$("#btnSettings").addEventListener("click", function () { renderRates(); UI.openModal("#settings"); });
  UI.$("#rates").addEventListener("input", function (ev) {
    var el = ev.target;
    if (el.id === "rates" || !el.hasAttribute("data-rate")) return;
    watch.rates[el.getAttribute("data-rate")] = Math.max(0, Number(el.value) || 0);
    UI.changed(); renderStats(); renderShop(); renderWatch();
  });
  UI.$("#rates").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-rate]");
    if (!b) return;
    var k = b.getAttribute("data-rate"), d = Number(b.getAttribute("data-d"));
    var box = UI.$('#rates input[data-rate="' + k + '"]');
    box.value = Math.max(0, (Number(box.value) || 0) + d);
    watch.rates[k] = Number(box.value); UI.changed();
    renderStats(); renderShop(); renderWatch();
  });
  UI.$("#btnRatesDefault").addEventListener("click", function () {
    watch.rates = JSON.parse(JSON.stringify(F.RATES)); UI.changed(); renderRates(); renderStats(); renderShop(); renderWatch();
  });

  /* export / import */
  UI.$("#btnIO").addEventListener("click", function () {
    UI.$("#ioText").value = UI.exportJSON();
    UI.$("#ioMsg").textContent = "";
    UI.openModal("#io");
  });
  UI.$("#btnCopyOut").addEventListener("click", function () {
    copy(UI.$("#ioText"), "#ioMsg", "Tracker copied to the clipboard.");
  });
  UI.$("#btnDownload").addEventListener("click", function () {
    var blob = new Blob([UI.exportJSON()], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "irminsul-tracker.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });
  UI.$("#btnPasteIn").addEventListener("click", function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { UI.$("#ioMsg").textContent = "Clipboard read is blocked — paste into the box instead."; return; }
    navigator.clipboard.readText().then(function (t) { UI.$("#ioText").value = t; UI.$("#ioMsg").textContent = "Pasted — press Import."; },
      function () { UI.$("#ioMsg").textContent = "Clipboard read is blocked — paste into the box instead."; });
  });
  UI.$("#btnImport").addEventListener("click", function () {
    try {
      var n = UI.importJSON(UI.$("#ioText").value);
      UI.$("#ioMsg").innerHTML = '<span class="good">Imported ' + n + " tracked characters.</span>";
      renderAll();
    } catch (e) { UI.$("#ioMsg").innerHTML = '<span style="color:var(--bad)">Could not read that: ' + esc(e.message) + "</span>"; }
  });
  function copy(el, msgSel, ok) {
    el.select();
    var done = function () { UI.$(msgSel).textContent = ok; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, function () { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  }
  UI.$("#btnCopyShop").addEventListener("click", function () {
    var txt = F.consolidate(UI.plans()).filter(function (e) { return e.miss > 0; })
      .map(function (e) { return "- " + e.name + " (" + (F.MAT_LABEL[e.cat] || e.cat) + "): need " + e.want + ", banked " + e.have + ", missing " + e.miss + " — " + e.who.filter(function (w) { return w.miss; }).map(function (w) { return w.name; }).join(", "); })
      .join("\n");
    var ta = document.createElement("textarea");
    ta.value = "Irminsul Forge — combined material list\n" + txt;
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); UI.toast("Combined list copied — " + txt.split("\n").length + " lines"); }
    catch (e) { UI.toast("Copy blocked by the browser", "warn"); }
    ta.remove();
  });

  /* a team handed over from the builder (?t=a,b,c,d) lands in the watchlist */
  (function adoptFromQuery() {
    var t = new URLSearchParams(location.search).get("t");
    if (!t) return;
    var names = t.split(",").map(function (s) { return s.trim(); }).filter(function (n) { return F.byName(n) && !UI.isTracked(n); });
    names.forEach(function (n) { UI.add(n); });
    if (names.length) setTimeout(function () { UI.toast("Tracking " + names.length + " character" + (names.length > 1 ? "s" : "") + " from your team"); renderAll(); }, 0);
  })();

  /* first paint */
  if (UI.migrated()) UI.toast("Moved your tracker from the old build — " + UI.tracked().length + " characters carried over");
  setView();
  renderAll();
})();

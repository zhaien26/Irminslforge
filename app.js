/* ==========================================================================
   Irminsul Forge — shared UI helpers (nav state, avatars, watchlist storage,
   toasts, modal, stat-target tiles). Loaded after data.js / img.js /
   forge-core.js / guide.js on every page.
   ========================================================================== */
(function () {
  "use strict";
  var D = window.FORGE, F = window.ForgeCore, IMG = window.FORGE_IMG || {};
  var G = window.ForgeGuide || null;   /* guide.js: stat targets + rotations (pages still work without it) */

  var EL_COLOR = D.elColor, EL_GLYPH = D.elGlyph;
  var CAT_COLOR = {
    gem: "#8fd8ee", specialty: "#a8d13f", boss: "#b48ce0", book: "#f0c96b",
    weekly: "#ff8f8f", crown: "#ffd86b", mob: "#8ba3c7"
  };

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  /* the 7.2 marquee: new this patch, or fronted on the banner art */
  var FEATURED = D.chars.filter(function (c, i) {
    return c.ver === D.version || (c.tags || []).indexOf("new") >= 0 || i < 7;
  }).map(function (c) { return c.n; });
  var isFeatured = function (n) { return FEATURED.indexOf(n) >= 0; };
  var slug = function (n) { return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };

  /* ---------- faces ---------- */
  function initials(name) {
    var clean = String(name).replace(/\(.*?\)/g, "").trim();
    var bits = clean.split(/[\s-]+/).filter(Boolean);
    return ((bits[0] || "?").slice(0, 1) + (bits[1] ? bits[1].slice(0, 1) : "")).toUpperCase();
  }
  function avatar(name, size) {
    var c = F.byName(name) || { e: "Anemo", r: 4 };
    var px = size || 44, src = IMG.IMG_CHAR && IMG.IMG_CHAR[name];
    var tint = "linear-gradient(150deg," + (EL_COLOR[c.e] || "#3d5c86") + "44,#0e1728 62%)";
    return '<span class="av r' + c.r + '" style="width:' + px + 'px;height:' + px + 'px;--fs:' + Math.max(10, Math.round(px * .34)) + 'px;background:' + tint + '">' +
      (src ? '<img src="' + src + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") +
      '<span class="mono" style="font-size:var(--fs)">' + esc(initials(name)) + "</span>" +
      (px >= 34 ? '<span class="el" style="color:' + (EL_COLOR[c.e] || "#fff") + '">' + esc(EL_GLYPH[c.e] || "") + "</span>" : "") +
      "</span>";
  }
  function avatarStack(names, size) {
    return '<span class="avstack">' + (names || []).filter(Boolean).map(function (n) { return avatar(n, size || 30); }).join("") + "</span>";
  }
  function stars(r) { return '<span class="stars r' + r + '">' + "★★★★★".slice(0, r) + "</span>"; }
  function elTag(c) {
    return '<span style="color:' + (EL_COLOR[c.e] || "#fff") + '">' + esc(EL_GLYPH[c.e] || "") + " " + esc(c.e) + "</span>";
  }
  function subline(c) {
    return elTag(c) + ' <span class="dim">·</span> ' + c.r + "★ <span class=\"dim\">·</span> " + esc(c.w);
  }
  function matIcon(name, cat, px) {
    var src = IMG.IMG_MAT && IMG.IMG_MAT[name];
    var size = px || 22;
    var bg = CAT_COLOR[cat] || "#3d5c86";
    if (src) return '<img src="' + src + '" alt="" loading="lazy" decoding="async" style="width:' + size + 'px;height:' + size + 'px;border-radius:6px;display:block" onerror="this.style.display=\'none\'">';
    return '<span style="width:' + size + 'px;height:' + size + 'px;border-radius:6px;display:grid;place-items:center;font-weight:800;font-size:' + Math.round(size * .5) + 'px;color:#0b1220;background:' + bg + '">' + esc(String(name).slice(0, 1)) + "</span>";
  }
  var catColor = function (c) { return CAT_COLOR[c] || "#3d5c86"; };

  /* ---------- watchlist (shared with the team builder) ---------- */
  var w = F.openWatch();
  var watch = w.data, store = w.store;
  var migrated = F.migrateLegacy();
  if (migrated) { watch = store.data; }

  function save() { store.save(); }
  function tracked() { return Object.keys(watch.chars); }
  function isTracked(n) { return !!watch.chars[n]; }
  function stateOf(n) { return watch.chars[n] || F.emptyState(); }
  function put(n, patch) {
    watch.chars[n] = Object.assign({}, stateOf(n), patch);
    save();
  }
  function add(n) { if (!watch.chars[n]) { watch.chars[n] = F.emptyState(); save(); } }
  function remove(n) { delete watch.chars[n]; save(); }
  function toggle(n) { if (isTracked(n)) remove(n); else add(n); save(); return isTracked(n); }
  function planOf(n) { return F.plan(n, stateOf(n)); }
  function plans() {
    return tracked().filter(function (n) { return F.byName(n); })
      .filter(function (n) { return !watch.onlyOwned || isOwned(n); })
      .map(planOf);
  }
  function isOwned(n) { return (watch.owned || []).indexOf(n) >= 0; }
  function toggleOwned(n) {
    watch.owned = watch.owned || [];
    var i = watch.owned.indexOf(n);
    if (i >= 0) watch.owned.splice(i, 1); else watch.owned.push(n);
    save(); return i < 0;
  }
  function rates() { return watch.rates || F.RATES; }
  function sortKey() { return watch.sort || "priority"; }
  function view() { return watch.view || "cards"; }

  function bar(pct, cls) {
    var k = pct >= 100 ? "full" : pct >= 60 ? (cls || "mid") : "low";
    return '<div class="track"><i class="' + k + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>';
  }
  function ring(pct, status) {
    var cls = status === "complete" ? " done" : status === "ready" ? " warn" : "";
    return '<span class="ring' + cls + '" style="--p:' + pct + '"><span>' + pct + "%</span></span>";
  }

  /* ---------- toasts ---------- */
  function toast(msg, kind) {
    var box = $("#toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; box.className = "toasts"; document.body.appendChild(box); }
    var t = document.createElement("div");
    t.className = "toast" + (kind ? " " + kind : "");
    t.innerHTML = msg;
    box.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .4s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 420); }, 2600);
  }

  /* ---------- modal ---------- */
  function openModal(sel) {
    var m = $(sel); if (!m) return;
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    var f = m.querySelector("input,select,button");
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeModal(sel) {
    var m = typeof sel === "string" ? $(sel) : sel; if (!m) return;
    m.classList.remove("open");
    document.body.style.overflow = "";
  }
  document.addEventListener("click", function (e) {
    var closer = e.target.closest && e.target.closest("[data-close]");
    if (closer) { closeModal(closer.getAttribute("data-close")); return; }
    if (e.target.classList && e.target.classList.contains("modal")) closeModal(e.target);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") $$(".modal.open").forEach(function (m) { closeModal(m); });
  });

  /* ---------- nav badge ---------- */
  function syncNav() {
    $$("[data-watchcount]").forEach(function (el) { el.textContent = tracked().length; });
    $$("[data-ownedcount]").forEach(function (el) { el.textContent = (watch.owned || []).length; });
    var blocked = store.isBlocked();
    $$("[data-storage-notice]").forEach(function (el) { el.hidden = !blocked; });
  }
  document.addEventListener("forge:watch", syncNav);
  function changed() { save(); syncNav(); document.dispatchEvent(new CustomEvent("forge:watch")); }

  /* ---------- export / import ---------- */
  function exportJSON() {
    var payload = { app: "irminsul-forge-tracker", version: 2, savedAt: new Date().toISOString(), data: watch };
    return JSON.stringify(payload, null, 2);
  }
  function importJSON(text) {
    var parsed = JSON.parse(text);
    var incoming = parsed && parsed.data ? parsed.data : parsed;
    if (!incoming || typeof incoming !== "object" || !incoming.chars) throw new Error("not an Irminsul tracker file");
    watch.chars = incoming.chars;
    watch.owned = incoming.owned || [];
    watch.rates = incoming.rates || watch.rates;
    watch.notes = incoming.notes || watch.notes;
    watch.stats = incoming.stats || watch.stats || {};
    changed();
    return Object.keys(watch.chars).length;
  }

  /* ---------- guide: stat targets, "your" numbers, rotation key-caps ----------
     Targets come from guide.js. What the player types into a "Yours" box is kept
     in watch.stats[name] = { hp: 31000, cr: 62, … } so it is saved, exported and
     imported together with the watchlist. */
  var PHASE_BADGE = { setup: "ice", buff: "gold", off: "warn", carry: "bad", field: "good" };

  function parseNum(raw) {
    var txt = String(raw == null ? "" : raw).replace(/[,\s%]/g, "");
    if (txt === "") return null;
    var n = Number(txt);
    return isFinite(n) && n >= 0 ? n : null;
  }
  function myStats(n) { return (watch.stats && watch.stats[n]) || {}; }
  function setMyStat(n, key, raw) {
    var v = parseNum(raw);
    if (!watch.stats || typeof watch.stats !== "object") watch.stats = {};
    var cur = watch.stats[n] || {};
    if (v == null) delete cur[key]; else cur[key] = v;
    if (Object.keys(cur).length) watch.stats[n] = cur; else delete watch.stats[n];
    save();
    return v;
  }
  function statScore(n) { return G ? G.statScore(n, myStats(n)) : null; }
  function verdict(r) {
    if (r.status === "great") return "★ goal reached";
    if (r.status === "ok") return "✓ minimum met";
    if (r.status === "below") return G.fmtStat(r.gap, r.unit) + " short";
    return "";
  }
  function sumText(sc) {
    if (!sc || !sc.total) return "";
    return sc.entered ? sc.met + " of " + sc.total + " met" : "not checked yet";
  }
  function statSummary(n) { return sumText(statScore(n)); }
  function statBig(r) { return r.range ? r.min + "–" + r.goal + "%" : G.fmtStat(r.min, r.unit) + "<i>+</i>"; }

  function statTile(name, r, edit) {
    if (r.none) {
      return '<div class="st na"><span class="lbl">' + esc(r.label) + '</span><b class="num">not needed</b>' +
        '<span class="goal">' + esc(r.hint || "") + "</span></div>";
    }
    return '<div class="st ' + r.status + '" data-st="' + esc(r.key) + '"' + (r.hint ? ' title="' + esc(r.hint) + '"' : "") + ">" +
      '<span class="lbl">' + esc(r.label) + "</span>" +
      '<b class="num">' + statBig(r) + "</b>" +
      '<span class="goal">' + (r.range ? "low end with a battery" : "goal <b>" + G.fmtStat(r.goal, r.unit) + "</b>") + "</span>" +
      (edit ? '<label class="mine"><span>Yours</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="9" placeholder="—"' +
        ' data-mystat="' + esc(r.key) + '" data-name="' + esc(name) + '" value="' + (r.value == null ? "" : r.value) + '"' +
        ' aria-label="Your ' + esc(r.label) + '"></label>' : "") +
      '<span class="verdict">' + esc(verdict(r)) + "</span></div>";
  }
  function mainsHTML(s) {
    if (!s.mains) return "";
    return '<div class="kv mains"><div><span>Sands</span><b>' + esc(s.mains.sands) + "</b></div>" +
      "<div><span>Goblet</span><b>" + esc(s.mains.goblet) + "</b></div>" +
      "<div><span>Circlet</span><b>" + esc(s.mains.circlet) + "</b></div></div>" +
      (s.subs ? '<p class="statsub"><span>Substats</span>' + esc(s.subs) + "</p>" : "");
  }
  /* the full block: one tile per stat, optional "Yours" inputs.
     opts: { edit: false } read-only · { mains: true } add main stats / substats ·
           { legend: false } no small print · { legend: "short" } one line of it */
  function statBlock(name, opts) {
    if (!G) return "";
    var s = G.statsFor(name);
    if (!s) return "";
    opts = opts || {};
    var edit = opts.edit !== false;
    var sc = statScore(name);
    return '<div class="statreq" data-statreq="' + esc(name) + '">' +
      '<div class="statgrid">' + sc.rows.map(function (r) { return statTile(name, r, edit); }).join("") + "</div>" +
      (opts.mains ? mainsHTML(s) : "") +
      (s.note ? '<p class="statnote">' + esc(s.note) + "</p>" : "") +
      (edit ? '<p class="stathelp"><b data-statsum="' + esc(name) + '">' + esc(sumText(sc)) + "</b> — type the numbers from your in-game " +
        "character screen into “Yours” and each box tells you how far off you are. Saved in this browser only.</p>" : "") +
      (opts.legend === false ? "" : opts.legend === "short" ? '<p class="statlegend">' + esc(G.STAT_SHORT) + "</p>" :
        '<p class="statlegend">' + esc(s.legend) +
        (sc.rows.some(function (r) { return r.range; }) ? " " + esc(G.ER_HINT) : "") + " " + esc(s.early) + "</p>") +
      "</div>";
  }
  /* compact card for the builder: all four members side by side */
  function statCard(name) {
    if (!G) return "";
    var s = G.statsFor(name), c = F.byName(name);
    if (!s || !c) return "";
    var sc = statScore(name);
    return '<article class="tstat" data-statreq="' + esc(name) + '">' +
      '<div class="hd">' + avatar(name, 38) + '<div class="who"><b>' + esc(name) + "</b>" +
      '<div class="dim">' + elTag(c) + " · " + esc(c.w) + "</div></div>" +
      '<a class="btn xs ghost" href="index.html?c=' + slug(name) + '" title="Full build sheet — you can type in your own stats there">Sheet ↗</a></div>' +
      '<div class="trows">' + sc.rows.map(function (r) {
        if (r.none) return '<div class="trow"><span>' + esc(r.label) + "</span><b>—</b><em>not needed</em></div>";
        return '<div class="trow ' + r.status + '"' + (r.hint ? ' title="' + esc(r.hint) + '"' : "") + "><span>" + esc(r.label) + "</span><b>" + statBig(r) + "</b>" +
          "<em>" + (r.value != null ? "yours " + G.fmtStat(r.value, r.unit) + (r.status === "below" ? " ✗" : " ✓") : r.range ? "" : "goal " + G.fmtStat(r.goal, r.unit)) + "</em></div>";
      }).join("") + "</div>" +
      (s.mains ? '<dl class="tmains"><div><dt>Sands</dt><dd>' + esc(s.mains.sands) + "</dd></div><div><dt>Goblet</dt><dd>" + esc(s.mains.goblet) +
        "</dd></div><div><dt>Circlet</dt><dd>" + esc(s.mains.circlet) + "</dd></div></dl>" : "") +
      (s.note ? '<p class="statnote">' + esc(s.note) + "</p>" : "") +
      "</article>";
  }
  /* keep every copy of a character's tiles in step while the player types */
  function refreshStats(name, source) {
    var sc = statScore(name);
    if (!sc) return;
    var byKey = {};
    sc.rows.forEach(function (r) { byKey[r.key] = r; });
    $$("[data-statreq]").forEach(function (block) {
      if (block.getAttribute("data-statreq") !== name) return;
      $$(".st[data-st]", block).forEach(function (tile) {
        var r = byKey[tile.getAttribute("data-st")];
        if (!r) return;
        tile.className = "st " + r.status;
        var v = tile.querySelector(".verdict");
        if (v) v.textContent = verdict(r);
        var inp = tile.querySelector("input[data-mystat]");
        if (inp && inp !== source) inp.value = r.value == null ? "" : r.value;
      });
    });
    $$("[data-statsum]").forEach(function (el) {
      if (el.getAttribute("data-statsum") === name) el.textContent = sumText(sc);
    });
  }
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!G || !el || !el.getAttribute || el.getAttribute("data-mystat") == null) return;
    var name = el.getAttribute("data-name");
    setMyStat(name, el.getAttribute("data-mystat"), el.value);
    refreshStats(name, el);
  });

  function keycaps(actions) {
    return '<span class="keys">' + (actions || []).map(function (t) {
      return '<kbd class="key ' + t.kind + '">' + esc(t.text) + "</kbd>";
    }).join("") + "</span>";
  }
  function phaseBadge(phase) {
    var ph = (G && G.PHASES[phase]) || {};
    return '<span class="badge ' + (PHASE_BADGE[phase] || "") + '" title="' + esc(ph.tip || "") + '">' + esc(ph.label || phase) + "</span>";
  }
  /* one character's own part of a rotation — used on build sheets */
  function rotLine(name) {
    if (!G) return "";
    var p = G.profile(name);
    if (!p) return "";
    var meta = [];
    if (p.seconds) meta.push("≈" + p.seconds + "s on field");
    if (p.lasts) meta.push("lasts " + p.lasts + "s");
    var part = function (label, x) {
      return x ? '<p class="rl-alt"><b>' + label + "</b>" + keycaps(x.actions) + " " + esc(x.text) + "</p>" : "";
    };
    return '<div class="rotline"><div class="rl-top">' + phaseBadge(p.phase) + keycaps(p.actions) +
      (meta.length ? '<span class="dim">' + esc(meta.join(" · ")) + "</span>" : "") + "</div>" +
      "<p>" + esc(p.text) + "</p>" +
      part("First:", p.pre) + part("When someone else carries:", p.alt) + "</div>";
  }

  window.UI = {
    D: D, F: F, G: G, esc: esc, $: $, $$: $$, slug: slug,
    avatar: avatar, avatarStack: avatarStack, stars: stars, subline: subline, elTag: elTag,
    matIcon: matIcon, catColor: catColor, elColor: function (e) { return EL_COLOR[e] || "#8fd8ee"; },
    bar: bar, ring: ring, toast: toast, openModal: openModal, closeModal: closeModal, syncNav: syncNav,
    changed: changed, watch: function () { return watch; }, save: changed,
    tracked: tracked, isTracked: isTracked, stateOf: stateOf, put: put, add: add, remove: remove,
    toggle: toggle, planOf: planOf, plans: plans, isOwned: isOwned, toggleOwned: toggleOwned,
    rates: rates, sortKey: sortKey, view: view, featured: function () { return FEATURED; }, isFeatured: isFeatured,
    exportJSON: exportJSON, importJSON: importJSON,
    myStats: myStats, setMyStat: setMyStat, statScore: statScore, statSummary: statSummary,
    statBlock: statBlock, statCard: statCard, refreshStats: refreshStats,
    keycaps: keycaps, phaseBadge: phaseBadge, rotLine: rotLine,
    storageBlocked: function () { return store.isBlocked(); },
    migrated: function () { return migrated; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncNav);
  else syncNav();
})();

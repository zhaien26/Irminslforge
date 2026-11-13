/* ==========================================================================
   Team builder. Slots + presets + rotation guide + stat targets + analysis,
   and a one-click hand-off into the Tracking Center so a planned team becomes
   a monitored team.
   ========================================================================== */
(function () {
  "use strict";
  var UI = window.UI, F = UI.F, D = UI.D;
  var G = window.ForgeGuide || null;           /* guide.js — rotations and stat targets */
  var esc = UI.esc;
  var SLOTS = 4;
  /* the 7.2 lineups from data.js, then the beginner lineups from guide.js */
  var PRESETS = (D.presets || []).concat(G ? G.STARTERS : []);
  var st = { team: [null, null, null, null], active: 0, pq: "", pEl: "all" };

  /* ?t=Mitya,Valeriy,… reproduces a shared team */
  (function init() {
    var t = new URLSearchParams(location.search).get("t");
    if (!t) return;
    t.split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, SLOTS).forEach(function (n, i) {
      if (F.byName(n)) st.team[i] = n;
    });
  })();

  var LINE = { dps: "Damage", sub: "Sub-DPS", support: "Support", sustain: "Sustain" };
  function tags(n) { return (F.byName(n) || {}).tags || []; }
  function has(tag) { return st.team.filter(Boolean).some(function (n) { return tags(n).indexOf(tag) >= 0; }); }
  function els() {
    var o = {};
    st.team.filter(Boolean).forEach(function (n) { var e = F.byName(n).e; o[e] = (o[e] || 0) + 1; });
    return o;
  }

  /* ---------- slots ---------- */
  function renderSeg() {
    UI.$("#slotSeg").innerHTML = [0, 1, 2, 3].map(function (i) {
      return '<button data-act="slot" data-i="' + i + '" aria-pressed="' + (st.active === i) + '">Slot ' + (i + 1) + "</button>";
    }).join("");
  }
  function renderSlots() {
    UI.$("#slots").innerHTML = st.team.map(function (n, i) {
      var c = n && F.byName(n);
      return '<div class="slot' + (n ? " filled" : "") + (st.active === i ? " active" : "") + '" data-act="pick" data-i="' + i + '" role="button" tabindex="0">' +
        (n ? '<button class="xbtn clear" data-act="clear" data-i="' + i + '" aria-label="Clear slot">✕</button>' +
          UI.avatar(n, 46) + '<span class="nm">' + esc(n) + "</span>" +
          '<span class="role">' + UI.elTag(c) + " · " + esc(LINE[c.cat] || c.cat) + "</span>" +
          (UI.isTracked(n) ? '<span class="badge good" style="position:absolute;left:8px;top:8px">tracked</span>' : "")
          : '<span style="font-size:24px;color:var(--dim)">＋</span><span class="nm">Slot ' + (i + 1) + "</span><span class=\"role\">pick a character</span>") +
        "</div>";
    }).join("");
  }

  /* ---------- detail for the focused slot ---------- */
  function renderDetail() {
    var n = st.team[st.active], box = UI.$("#detail");
    UI.$("#detailHint").textContent = n ? "slot " + (st.active + 1) : "nothing in the focused slot";
    if (!n) {
      box.innerHTML = '<p class="dim" style="font-size:13.5px">Pick a character for slot ' + (st.active + 1) +
        " and this panel fills with their best weapons, artifact set and the partners that work with them.</p>";
      return;
    }
    var c = F.byName(n), b = c.build || {};
    var er = G ? G.erOf(n) : (D.erTarget && D.erTarget[n]);
    var gs = G ? G.statsFor(n) : null;
    /* characters without a build sheet in data.js still get a set / main stats / substats from the guide */
    var art = b.art || (gs && gs.set ? [gs.set, gs.mainsRaw, gs.subs] : null);
    var row = function (label, list) {
      if (!list || !list.length) return "";
      return "<h4>" + label + "</h4><ul>" + list.slice(0, 3).map(function (p) {
        return '<li><b>' + esc(p[0]) + "</b> — " + esc(p[1]) + "</li>";
      }).join("") + "</ul>";
    };
    var recs = (b.budget || []).concat(b.prem || []).map(function (p) { return p[0]; }).filter(function (x, i, a) { return a.indexOf(x) === i && !st.team.includes(x); });
    box.innerHTML = '<div style="display:flex;gap:13px;align-items:center">' + UI.avatar(n, 58) +
      "<div><h3 style=\"font-size:18px\">" + esc(n) + " " + UI.stars(c.r) + "</h3>" +
      '<div class="dim" style="font-size:12.5px">' + UI.elTag(c) + " · " + esc(c.w) + " · " + esc(LINE[c.cat] || "") + "</div></div>" +
      '<span style="margin-left:auto;display:flex;gap:6px;flex-direction:column">' +
      '<button class="btn xs ' + (UI.isTracked(n) ? "" : "gold") + '" data-act="track" data-name="' + esc(n) + '">' + (UI.isTracked(n) ? "✓ Tracking" : "＋ Track") + "</button>" +
      '<a class="btn xs ghost" href="index.html?c=' + UI.slug(n) + '">Full sheet ↗</a></span></div>' +
      (er ? '<p style="font-size:13px;margin:11px 0 0">Energy Recharge target <b class="mono gold">' + er[0] + "–" + er[1] + "%</b>" +
        (c.r === 4 ? " · 4★, so expect to lean on ER more than CRIT" : "") + "</p>"
        : (G && G.noEnergy(n) ? '<p style="font-size:13px;margin:11px 0 0">Uses no Energy — <b>Energy Recharge is not needed</b>.</p>' : "")) +
      '<div class="build">' +
      (UI.rotLine ? "<h4>In a rotation</h4>" + UI.rotLine(n) : "") +
      row("Best weapon", b.bis) + row("4★ / free", (b.four || []).concat(b.free || []).slice(0, 3)) +
      (art ? "<h4>Artifact</h4><ul>" + art.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (recs.length ? '<h4>Add one of these</h4><div class="pilllist">' + recs.slice(0, 8).map(function (x) {
        return '<button class="pill" data-act="add" data-name="' + esc(x) + '">' + UI.avatar(x, 20) + " " + esc(x) + "</button>";
      }).join("") + "</div><p class=\"dim\" style=\"font-size:12px;margin:8px 0 0\">Choose one to drop them into the first empty slot.</p>" : "") +
      "</div>";
  }

  /* ---------- analysis ---------- */
  function renderAnalysis() {
    var team = st.team.filter(Boolean), box = UI.$("#analysisBody");
    if (team.length < 2) {
      box.innerHTML = '<p class="dim" style="font-size:13.5px">Fill at least two slots and this checks your resonance, ' +
        "whether the Stellar or Lunar engine is on, and whether damage / buffing / healing are all covered.</p>";
      return;
    }
    var e = els(), out = [];
    var res = Object.keys(e).filter(function (k) { return e[k] >= 2; });
    out.push(["Resonance", res.length
      ? res.map(function (k) { return '<b class="ice">' + esc((D.resonance[k] || [""])[0]) + "</b> <span class=\"dim\">(" + esc((D.resonance[k] || ["", ""])[1]) + ")</span>"; }).join("<br>")
      : '<span class="dim">none — no element is doubled up</span>', res.length ? "good" : ""]);

    var linch = has("linchpin"), cryo = e.Cryo, electro = e.Electro, anemo = e.Anemo;
    var sc = cryo && electro && linch;
    var sw = anemo && cryo && (linch || has("swirlEnabler"));
    var lunar = (has("lunarAll") || team.indexOf("Columbina") >= 0);
    var lunarLine = ["lunarBloom: Bloom", "lunarCharged: Charged", "lunarCrystallize: Crystallize"]
      .filter(function (k) { return has(k.split(":")[0]); }).map(function (k) { return k.split(":")[1]; });
    out.push(["Stellar engine",
      sc ? "<b class=\"good\">on</b> — " + (linch ? "a Linchpin (" + esc(team.filter(function (n) { return tags(n).indexOf("linchpin") >= 0; }).join(", ")) + ") is on the team" : "") + ", so Cryo + Electro becomes Stellar-Conduct."
        : (cryo && electro ? '<b class="bad">off</b> — you have Cryo and Electro but no <b>Stellar Linchpin</b> (Sandrone, Odette, Cryo Traveler, Mitya). You will only get plain Superconduct.'
          : '<span class="dim">no Cryo + Electro pair, so nothing to convert</span>'), sc ? "good" : (cryo && electro ? "bad" : "")]);
    out.push(["Stellar Swirl", sw ? '<b class="good">available</b> — Anemo + Cryo with an enabler; keep a Polestar Field up for the buff.'
      : '<span class="dim">needs Anemo + Cryo and a Linchpin / swirl enabler</span>', sw ? "good" : ""]);
    out.push(["Lunar reactions", lunarLine.length
      ? (lunar ? "<b class=\"good\">" + esc(lunarLine.join(" + ")) + " with Columbina enabling</b>" : "<b class=\"warn\">" + esc(lunarLine.join(" + ")) + '</b> — enablers are here but <b>Columbina</b> is not, so these stay plain reactions')
      : '<span class="dim">none in this lineup</span>', lunarLine.length && lunar ? "good" : ""]);

    var cats = team.map(function (n) { return F.byName(n).cat; });
    var gaps = [];
    if (cats.indexOf("dps") < 0 && cats.indexOf("sub") < 0) gaps.push("nobody carries damage");
    if (cats.indexOf("sustain") < 0) gaps.push("no healer or shielder");
    if (cats.indexOf("support") < 0) gaps.push("no buffer / debuffer");
    var focus = F.byName(st.team[st.active]);
    var suggestions = gaps.length && focus && focus.build
      ? (focus.build.budget || []).map(function (p) { return p[0]; }).filter(function (x) { return team.indexOf(x) < 0; }).slice(0, 3)
      : [];
    out.push(["Role coverage", (gaps.length ? '<b class="warn">' + esc(gaps.join(", ")) + "</b>" : '<b class="good">all three covered</b> — damage, buffing and sustain are present') +
      (suggestions.length ? '<div class="pilllist" style="margin-top:7px">' + suggestions.map(function (x) {
        return '<button class="pill" data-act="add" data-name="' + esc(x) + '">' + UI.avatar(x, 18) + " " + esc(x) + "</button>";
      }).join("") + "</div>" : ""), gaps.length ? "warn" : "good"]);

    var owed = team.map(function (n) { return UI.isTracked(n) ? UI.planOf(n).missing : null; }).filter(function (x) { return x !== null; });
    box.innerHTML = '<div style="display:grid;gap:9px">' + out.map(function (r) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#0d1626">' +
        '<span class="badge ' + (r[2] || "") + '" style="flex:0 0 106px;justify-content:center">' + esc(r[0]) + "</span>" +
        '<span style="font-size:13px;flex:1 1 auto">' + r[1] + "</span></div>";
    }).join("") + "</div>" +
      '<div class="foot" style="margin-top:12px"><span class="dim" style="font-size:12.5px">' +
      (owed.length ? "Your tracked members of this team owe " + owed.reduce(function (a, b) { return a + b; }, 0) + " materials in total." : "Nothing tracked from this team yet.") +
      "</span>" +
      '<button class="btn sm gold" data-act="trackteam">✓ Track all ' + team.length + "</button></div>";
  }

  function renderPresets() {
    var main = [], starters = [];
    PRESETS.forEach(function (p, i) {
      (p.starter ? starters : main).push('<button class="preset' + (p.starter ? " starter" : "") + '" data-act="preset" data-i="' + i + '"><b>' + esc(p.name) + "</b>" +
        UI.avatarStack(p.team, 30) +
        "<p>" + esc(p.why) + "</p></button>");
    });
    UI.$("#presets").innerHTML = main.join("");
    var box = UI.$("#starters"), wrap = UI.$("#startersWrap");
    if (box) box.innerHTML = starters.join("");
    if (wrap) wrap.hidden = !starters.length;
  }

  /* ---------- rotation guide: who to press, in what order, and why ---------- */
  var lastRotation = null;
  function rotationAside(rot) {
    var notes = rot && rot.notes.length
      ? '<div class="rnotes"><div class="eyebrow">' + (rot.curated ? "For this lineup" : "Watch out for") + "</div><ul>" +
        rot.notes.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>"
      : "";
    return '<aside class="rside">' + notes +
      '<div class="rrules"><div class="eyebrow">Every rotation follows 4 rules</div><ol>' +
      G.BASICS.map(function (b) { return "<li><b>" + esc(b[0]) + ".</b> " + esc(b[1]) + "</li>"; }).join("") + "</ol></div>" +
      '<div class="rlegend">' + G.LEGEND.map(function (k) {
        return '<span><kbd class="key ' + k[1] + '">' + esc(k[0]) + "</kbd>" + esc(k[2]) + "</span>";
      }).join("") + "</div></aside>";
  }
  function renderRotation() {
    var box = UI.$("#rotation");
    if (!box) return;
    var meta = UI.$("#rotMeta"), team = st.team.filter(Boolean);
    if (!G) { var panel = UI.$("#rotationPanel"); if (panel) panel.hidden = true; return; }
    var rot = lastRotation = team.length ? G.rotation(team) : null;
    if (meta) meta.hidden = !rot;
    if (!rot) {
      box.innerHTML = '<div class="rot"><div class="empty"><h3>Pick a team and this becomes a step-by-step rotation</h3>' +
        "<p>Who to swap to, which buttons to press, in what order — and why. Fill the slots, or load a lineup above: " +
        "the three starter teams are the easiest place to learn.</p></div>" + rotationAside(null) + "</div>";
      return;
    }
    UI.$("#rotLen").textContent = "≈ " + rot.seconds + "s per loop";
    var bar = '<div class="rotbar" role="img" aria-label="How the ' + rot.seconds + ' seconds of one loop are split between the steps">' +
      rot.steps.map(function (s) {
        var col = UI.elColor(s.element);
        return '<span style="flex:' + s.seconds + " 1 0;background:" + col + "4d;border-bottom-color:" + col + '" title="' + esc(s.who) + " · ≈" + s.seconds + 's"><b>' + s.n + "</b></span>";
      }).join("") + "</div>" +
      '<div class="rotcap"><span>0s</span><span>each block is one step — wider means longer on field</span><span>' + rot.seconds + "s</span></div>";
    var steps = rot.steps.map(function (s) {
      return '<li class="rstep ' + s.phase + '">' +
        '<span class="no" aria-hidden="true">' + s.n + "</span>" + UI.avatar(s.who, 42) +
        '<div class="body"><div class="top"><b>' + esc(s.who) + "</b>" + UI.phaseBadge(s.phase) +
        '<span class="time">≈' + s.seconds + "s" + (s.lasts ? " · lasts " + s.lasts + "s" : "") + "</span></div>" +
        UI.keycaps(s.actions) +
        "<p>" + esc(s.text) + "</p></div></li>";
    }).join("");
    box.innerHTML = '<div class="rot"><div>' + bar +
      '<ol class="rsteps">' + steps + "</ol>" +
      '<p class="rloop">↻ Back to step 1 — keep the same order every loop.' +
      (rot.partial ? " <b>" + (SLOTS - rot.team.length) + " slot" + (SLOTS - rot.team.length > 1 ? "s are" : " is") + " still empty</b>, so this is only part of the loop." : "") +
      "</p></div>" + rotationAside(rot) + "</div>";
  }

  /* ---------- stat targets for everyone in the team ---------- */
  function renderTeamStats() {
    var box = UI.$("#teamStats"), panel = UI.$("#teamStatsPanel");
    if (!box) return;
    var team = st.team.filter(Boolean);
    var show = !!(G && UI.statCard && team.length);
    if (panel) panel.hidden = !show;
    box.innerHTML = show
      ? '<div class="tstats">' + team.map(function (n) { return UI.statCard(n); }).join("") + "</div>" +
        '<p class="statlegend" style="margin-top:10px">' + esc(G.STAT_LEGEND) + " " + esc(G.ER_HINT) + " " + esc(G.STAT_EARLY) +
        " Open a character’s <b>Sheet</b> to type in your own numbers and see how far off you are.</p>"
      : "";
  }

  /* ---------- character picker ---------- */
  function renderPick() {
    var rows = D.chars.filter(function (c) {
      if (st.pEl !== "all" && c.e !== st.pEl) return false;
      if (st.pq && (c.n + " " + c.e + " " + c.w + " " + (c.role || "")).toLowerCase().indexOf(st.pq.toLowerCase()) < 0) return false;
      return true;
    });
    UI.$("#pEl").innerHTML = ["all", "Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"].map(function (e) {
      return '<button class="chip" data-pel="' + e + '" aria-pressed="' + (st.pEl === e) + '">' + (e === "all" ? "All" : (D.elGlyph[e] || "") + " " + e) + "</button>";
    }).join("");
    UI.$("#pickFor").textContent = "→ slot " + (st.active + 1);
    UI.$("#pGrid").innerHTML = rows.map(function (c) {
      return '<div class="rcard" data-act="choose" data-name="' + esc(c.n) + '" role="button" tabindex="0">' + UI.avatar(c.n, 42) +
        '<div class="meta"><h3>' + esc(c.n) + " " + UI.stars(c.r) + "</h3>" +
        '<div class="role">' + esc(c.role || "") + "</div>" +
        '<div class="foot"><span class="mini-pct dim">' + esc(c.w) + "</span>" +
        '<button class="trackbtn" data-act="track" data-name="' + esc(c.n) + '" aria-pressed="' + UI.isTracked(c.n) + '">' +
        (UI.isTracked(c.n) ? "✓ Tracked" : "＋ Track") + "</button></div></div></div>";
    }).join("") || '<p class="dim">Nobody matches.</p>';
  }

  function renderAll() {
    renderSeg(); renderSlots(); renderRotation(); renderTeamStats(); renderDetail(); renderAnalysis(); UI.syncNav();
    /* keep the hand-off a real link: middle-click / open-in-tab works, and the
       team rides along in the query string */
    var link = UI.$("#btnTrackTeam"), team = st.team.filter(Boolean);
    if (link) {
      link.href = team.length ? "tracker.html?t=" + encodeURIComponent(team.join(",")) : "tracker.html";
      link.textContent = team.length ? "✓ Track this team (" + team.length + ")" : "✓ Track this team";
    }
    if (UI.$("#pick").classList.contains("open")) renderPick();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (ev) {
    var pel = ev.target.closest("[data-pel]");
    if (pel) { st.pEl = pel.getAttribute("data-pel"); renderPick(); return; }
    var b = ev.target.closest("[data-act]");
    if (!b) return;
    var a = b.getAttribute("data-act");
    var name = b.getAttribute("data-name");
    if (a === "slot") { st.active = Number(b.getAttribute("data-i")); renderAll(); }
    else if (a === "clear") { ev.stopPropagation(); st.team[Number(b.getAttribute("data-i"))] = null; renderAll(); }
    else if (a === "pick") {
      st.active = Number(b.getAttribute("data-i"));
      UI.openModal("#pick");          /* open first: renderAll() only fills the list while the picker is open */
      renderAll();
      UI.$("#pick .box").scrollTop = 0;
    }
    else if (a === "choose") {
      var empty = st.team.indexOf(null); var i = st.team[st.active] ? (empty < 0 ? st.active : empty) : st.active;
      st.team[i] = name; UI.closeModal("#pick"); renderAll();
      UI.toast("<b>" + esc(name) + "</b> → slot " + (i + 1));
    }
    else if (a === "add") {
      var e2 = st.team.indexOf(null);
      if (e2 < 0) e2 = st.active;
      st.team[e2] = name; renderAll(); UI.toast("Added <b>" + esc(name) + "</b> to slot " + (e2 + 1));
    }
    else if (a === "preset") {
      var preset = PRESETS[Number(b.getAttribute("data-i"))];
      if (!preset) return;
      st.team = preset.team.slice(0, SLOTS).concat([null, null, null, null]).slice(0, SLOTS);
      renderAll();
      if (G) UI.toast("Loaded <b>" + esc(preset.name) + "</b> — <a href=\"#rotationPanel\" style=\"color:var(--ice)\">see its rotation ↓</a>");
    }
    else if (a === "track") {
      ev.stopPropagation();
      var now = UI.toggle(name);
      UI.toast(now ? "Tracking <b>" + esc(name) + "</b> — open the Tracking Center to set their level" : "Stopped tracking <b>" + esc(name) + "</b>", now ? "" : "warn");
      renderAll();
    }
    else if (a === "trackteam") {
      var team = st.team.filter(Boolean), added = team.filter(function (n) { return !UI.isTracked(n); });
      added.forEach(function (n) { UI.add(n); });
      UI.toast(added.length ? "Now tracking " + added.length + " from this team — <a href=\"tracker.html\" style=\"color:var(--ice)\">open the Tracking Center →</a>"
        : "All four are already tracked — <a href=\"tracker.html\" style=\"color:var(--ice)\">go monitor them →</a>");
      renderAll();
    }
  });
  UI.$("#pq").addEventListener("input", function () { st.pq = this.value.trim(); renderPick(); });
  UI.$("#btnShare").addEventListener("click", function () {
    var team = st.team.filter(Boolean);
    if (!team.length) { UI.toast("Put someone in a slot first", "warn"); return; }
    var url = location.origin + location.pathname + "?t=" + encodeURIComponent(team.join(","));
    UI.copyText(url, function () { UI.toast("Share link copied — " + team.length + " characters"); },
      function () { UI.toast("Copy blocked; the link is in the address bar shape: ?t=" + UI.esc(team.join(",")), "warn"); });
  });
  var copyRot = UI.$("#btnCopyRot");
  if (copyRot) copyRot.addEventListener("click", function () {
    if (!lastRotation) { UI.toast("Put someone in a slot first", "warn"); return; }
    UI.copyText(G.rotationText(lastRotation), function () { UI.toast("Rotation copied as text — paste it anywhere"); },
      function () { UI.toast("Copy was blocked by the browser", "warn"); });
  });
  UI.$("#btnTrackTeam").addEventListener("click", function (ev) {
    if (!st.team.filter(Boolean).length) { ev.preventDefault(); UI.toast("Pick at least one character first", "warn"); }
  });
  document.addEventListener("forge:watch", renderAll);

  renderPresets(); renderAll();
})();

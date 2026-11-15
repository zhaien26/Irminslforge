/* ==========================================================================
   Roster & builds page (Astral Layout 2 · Bento Showcase + Spotlight Modal).
   Optimized with DOM card reuse + precomputed search index so filtering 123
   characters and toggling track states never re-decodes character portraits.
   ========================================================================== */
(function () {
  "use strict";
  var UI = window.UI, F = UI.F, D = UI.D;
  var esc = UI.esc;
  var G = window.ForgeGuide || null;
  var f = { q: "", el: "all", w: "all", r: "all", cat: "all", owned: false, tracked: false };

  var _gridNodes = Object.create(null);
  var _featNodes = Object.create(null);
  var _emptyNode = null;

  /* ---------- filter chips ---------- */
  function chips() {
    var els = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"];
    UI.$("#elChips").innerHTML = els.map(function (e) {
      return '<button class="chip" data-f="el" data-v="' + e + '" aria-pressed="' + (f.el === e) + '" style="' +
        (f.el === e ? "" : "color:" + UI.elColor(e)) + '">' + esc(D.elGlyph[e] || "") + " " + e + "</button>";
    }).join("");
    UI.$("#miscChips").innerHTML =
      ["Sword", "Claymore", "Polearm", "Catalyst", "Bow"].map(function (w) {
        return '<button class="chip" data-f="w" data-v="' + w + '" aria-pressed="' + (f.w === w) + '">' + w + "</button>";
      }).join("") +
      '<button class="chip" data-f="r" data-v="5" aria-pressed="' + (f.r === "5") + '">5★</button>' +
      '<button class="chip" data-f="r" data-v="4" aria-pressed="' + (f.r === "4") + '">4★</button>' +
      '<button class="chip" data-f="cat" data-v="dps" aria-pressed="' + (f.cat === "dps") + '">DPS</button>' +
      '<button class="chip" data-f="cat" data-v="sub" aria-pressed="' + (f.cat === "sub") + '">Sub-DPS</button>' +
      '<button class="chip" data-f="cat" data-v="support" aria-pressed="' + (f.cat === "support") + '">Support</button>' +
      '<button class="chip" data-f="cat" data-v="sustain" aria-pressed="' + (f.cat === "sustain") + '">Sustain</button>' +
      '<button class="chip" data-f="owned" aria-pressed="' + f.owned + '">Owned <span class="n">' + (UI.watch().owned || []).length + "</span></button>" +
      '<button class="chip" data-f="tracked" aria-pressed="' + f.tracked + '">Tracked <span class="n">' + UI.tracked().length + "</span></button>" +
      (isFiltered() ? '<button class="chip" data-f="clear" style="color:var(--gold)">✕ clear</button>' : "");
  }
  function isFiltered() {
    return f.el !== "all" || f.w !== "all" || f.r !== "all" || f.cat !== "all" || f.owned || f.tracked || !!f.q;
  }
  function match(c) {
    if (f.el !== "all" && c.e !== f.el) return false;
    if (f.w !== "all" && c.w !== f.w) return false;
    if (f.r !== "all" && String(c.r) !== f.r) return false;
    if (f.cat !== "all" && c.cat !== f.cat) return false;
    if (f.owned && !UI.isOwned(c.n)) return false;
    if (f.tracked && !UI.isTracked(c.n)) return false;
    if (f.q) {
      if (UI.searchHay(c).indexOf(f.q.toLowerCase()) < 0) return false;
    }
    return true;
  }

  /* ---------- cards (build once, mutate lightly) ---------- */
  function cardHTML(c) {
    var on = UI.isTracked(c.n);
    var owned = UI.isOwned(c.n);
    var p = on ? UI.planOf(c.n) : null;
    var s = p ? F.statusOf(p) : null;
    return '<article class="rcard' + (on ? " isTracked" : "") + (owned ? " isOwned" : "") + '" data-act="open" data-name="' + esc(c.n) + '" tabindex="0" role="button" aria-label="Build sheet for ' + esc(c.n) + '">' +
      '<div class="toprow">' + UI.avatar(c.n, 52) +
      '<div class="meta"><h3><span>' + esc(c.n) + "</span>" + UI.stars(c.r) + "</h3>" +
      '<div class="sub" style="font-size:11.5px;margin-top:2px">' + UI.elTag(c) + ' <span class="dim">·</span> ' + esc(c.w) +
      (c.ver === D.version ? ' <span class="badge gold" style="font-size:9.5px;padding:2px 6px">7.2</span>' : "") + "</div>" +
      "</div></div>" +
      '<div class="role">' + esc(c.role || "") + "</div>" +
      '<div class="foot">' +
      (p ? '<span class="mini-pct" title="Build readiness">' + UI.ring(p.pct, s).replace('style="--p:' + p.pct + '"', 'style="--p:' + p.pct + ';width:28px;height:28px"').replace("<span>", "<span style=\"font-size:8.5px\">") +
        '<span>' + (p.missing ? p.missing + " owed" : "complete") + "</span></span>"
        : '<span class="mini-pct dim">not tracked</span>') +
      '<span style="display:inline-flex;gap:5px;align-items:center">' +
      '<button class="ownbtn" data-act="own" data-name="' + esc(c.n) + '" aria-pressed="' + owned + '" title="Mark as owned on your account">★</button>' +
      '<button class="trackbtn" data-act="track" data-name="' + esc(c.n) + '" aria-pressed="' + on + '">' + (on ? "✓ Tracking" : "＋ Track") + "</button>" +
      "</span></div></article>";
  }
  function makeCardEl(c) {
    var tpl = document.createElement("template");
    tpl.innerHTML = cardHTML(c);
    return tpl.content.firstElementChild;
  }
  function syncCardEl(el, c) {
    if (!el || !c) return;
    var on = UI.isTracked(c.n), owned = UI.isOwned(c.n);
    el.classList.toggle("isTracked", on);
    el.classList.toggle("isOwned", owned);
    var tb = el.querySelector('[data-act="track"]');
    if (tb) { tb.setAttribute("aria-pressed", String(on)); tb.textContent = on ? "✓ Tracking" : "＋ Track"; }
    var ob = el.querySelector('[data-act="own"]');
    if (ob) { ob.setAttribute("aria-pressed", String(owned)); }
    var foot = el.querySelector(".foot");
    if (foot) {
      var pctEl = foot.querySelector(".mini-pct");
      if (pctEl) {
        var p = on ? UI.planOf(c.n) : null;
        var s = p ? F.statusOf(p) : null;
        if (p) {
          pctEl.className = "mini-pct";
          pctEl.innerHTML = UI.ring(p.pct, s).replace('style="--p:' + p.pct + '"', 'style="--p:' + p.pct + ';width:28px;height:28px"').replace("<span>", '<span style="font-size:8.5px">') +
            "<span>" + (p.missing ? p.missing + " owed" : "complete") + "</span>";
        } else {
          pctEl.className = "mini-pct dim";
          pctEl.textContent = "not tracked";
        }
      }
    }
  }
  function initGrids() {
    var grid = UI.$("#grid"), featRow = UI.$("#featRow");
    if (!grid.childElementCount) {
      var frag = document.createDocumentFragment();
      D.chars.forEach(function (c) {
        var el = makeCardEl(c);
        _gridNodes[c.n] = el;
        frag.appendChild(el);
      });
      _emptyNode = document.createElement("div");
      _emptyNode.className = "empty";
      _emptyNode.style.gridColumn = "1/-1";
      _emptyNode.hidden = true;
      _emptyNode.innerHTML = "<h3>Nobody matches</h3><p>Clear a filter or two — the roster is 123 deep.</p>";
      frag.appendChild(_emptyNode);
      grid.appendChild(frag);
    }
    if (featRow && !featRow.childElementCount) {
      var ffrag = document.createDocumentFragment();
      UI.featured().map(function (n) { return F.byName(n); }).filter(Boolean).forEach(function (c) {
        var el = makeCardEl(c);
        _featNodes[c.n] = el;
        ffrag.appendChild(el);
      });
      featRow.appendChild(ffrag);
    }
  }
  function filterGrid() {
    initGrids();
    var shown = 0;
    for (var i = 0; i < D.chars.length; i++) {
      var c = D.chars[i], ok = match(c);
      var el = _gridNodes[c.n];
      if (el) el.hidden = !ok;
      if (ok) shown++;
    }
    if (_emptyNode) _emptyNode.hidden = shown > 0;
    UI.$("#rosterCount").textContent = "(" + shown + " of " + D.chars.length + ")";
  }
  function syncAllCards() {
    D.chars.forEach(function (c) {
      if (_gridNodes[c.n]) syncCardEl(_gridNodes[c.n], c);
      if (_featNodes[c.n]) syncCardEl(_featNodes[c.n], c);
    });
  }

  /* ---------- watchlist preview in the bento tile ---------- */
  function renderPreview() {
    var plans = UI.plans().sort(function (a, b) { return b.missing - a.missing; });
    var box = UI.$("#watchPreview");
    if (!plans.length) {
      box.innerHTML = '<p class="dim" style="margin:0;font-size:13px">Nothing tracked yet. Click <b>＋ Track</b> on any ' +
        "card below, then open the Tracking Center to set levels and see what you owe.</p>" +
        '<a class="btn sm gold" style="margin-top:12px;align-self:flex-start" href="tracker.html">Open Tracking Center</a>';
      return;
    }
    var a = F.aggregate(plans, UI.rates());
    box.innerHTML = '<div style="display:flex;gap:12px;align-items:center">' + UI.ring(a.avgPct, "") +
      "<div><b style=\"font-size:15.5px\">" + plans.length + " tracked</b><div class=\"dim\" style=\"font-size:12px\">" +
      a.missing + " items owed · " + a.readyToAscend + " ready</div></div></div>" +
      '<div style="margin-top:10px;display:grid;gap:5px">' +
      plans.slice(0, 3).map(function (p) {
        return '<button class="whochip" data-act="open" data-name="' + esc(p.name) + '" style="justify-content:space-between;display:flex;width:100%">' +
          '<span class="who" style="display:flex;gap:7px;align-items:center">' + UI.avatar(p.name, 20) + esc(p.name) + "</span>" +
          '<b class="mono" style="color:' + (p.missing ? "var(--warn)" : "var(--good)") + '">' + (p.missing ? "−" + p.missing : "✓") + "</b></button>";
      }).join("") + "</div>" +
      '<a class="btn sm" style="margin-top:10px;align-self:flex-start" href="tracker.html">Monitor them →</a>';
  }

  /* ---------- build sheet ---------- */
  function weaponRows(list, label) {
    if (!list || !list.length) return "";
    var IMG = UI.img ? UI.img() : (window.FORGE_IMG || {});
    return "<h4>" + label + "</h4><div class=\"wlist\">" + list.map(function (pair) {
      var icon = IMG.IMG_WEAPON && IMG.IMG_WEAPON[pair[0]] ? '<img src="' + IMG.IMG_WEAPON[pair[0]] + '" alt="" width="26" height="26" decoding="async" style="width:26px;height:26px;border-radius:6px;object-fit:contain;background:#070c18">' : "";
      return '<div class="wrow"><div style="display:flex;gap:9px;align-items:center">' + icon + "<b>" + esc(pair[0]) + "</b></div><p>" + esc(pair[1]) + "</p></div>";
    }).join("") + "</div>";
  }
  function setIcons(art) {
    var IMG = UI.img ? UI.img() : (window.FORGE_IMG || {});
    if (!IMG.IMG_SET) return "";
    var found = Object.keys(IMG.IMG_SET).filter(function (k) { return art && art[0] && art[0].indexOf(k) >= 0; });
    if (!found.length) return "";
    return '<div style="display:flex;gap:8px;margin:8px 0">' + found.slice(0, 4).map(function (k) {
      return '<span title="' + esc(k) + '" style="display:grid;place-items:center;width:40px;height:40px;border-radius:9px;border:1px solid var(--line);background:#070c18">' +
        '<img src="' + IMG.IMG_SET[k] + '" alt="" width="30" height="30" decoding="async" style="width:30px;height:30px;object-fit:contain"></span>';
    }).join("") + '<span class="dim" style="align-self:center;font-size:12px">' + esc(found.map(function (k) { return k; }).join(" or ")) + "</span></div>";
  }
  function matePills(list) {
    if (!list || !list.length) return "";
    return '<div class="pilllist">' + list.map(function (pair) {
      return '<button class="pill" data-act="open" data-name="' + esc(pair[0]) + '" title="' + esc(pair[1]) + '">' +
        UI.avatar(pair[0], 20) + " " + esc(pair[0]) + "</button>";
    }).join("") + "</div>";
  }
  function matLines(name) {
    var m = D.mats[name];
    if (!m) return "";
    var line = function (rows) {
      return '<div style="display:flex;gap:7px;flex-wrap:wrap">' + rows.map(function (r) {
        return '<span class="pill" style="cursor:default">' + UI.matIcon(r[0], r[2], 18) + " " + esc(r[0]) + ' <b class="mono">×' + r[1] + "</b></span>";
      }).join("") + "</div>";
    };
    var asc = (m.asc && m.asc.items) || [], tal = (m.tal && m.tal.items) || [];
    return (asc.length ? "<h4>Ascension totals</h4>" + line(asc) : '<h4>Ascension totals</h4><p class="dim" style="font-size:12.5px;margin:0">' + esc((m.asc && m.asc.note) || "Follows the element you are attuned to.") + "</p>") +
      (tal.length ? "<h4>Talent totals <span class=\"dim\" style=\"text-transform:none;letter-spacing:0\">(per talent)</span></h4>" + line(tal) : "");
  }
  function owedBlock(name) {
    if (!UI.isTracked(name)) {
      return '<div class="notice info" style="margin-top:14px"><span>◎</span><span>Not in your watchlist yet — ' +
        "<b>Track this character</b> and the Tracking Center will work out what you still owe, when you can farm it and how long that takes.</span></div>";
    }
    var p = UI.planOf(name);
    var rows = p.asc.rows.concat(p.talent.rows).filter(function (r) { return r.miss > 0; }).slice(0, 8);
    return '<div class="panel" style="margin-top:14px;background:rgba(5,8,17,0.72)"><div class="eyebrow">Your remaining debt</div>' +
      '<div class="rowline" style="margin:8px 0"><span>' + (p.missing ? p.missing + " items · " + F.fmtMora(p.mora) + " Mora" : "Nothing owed — this build is fully banked") + "</span>" +
      "<span>" + esc(F.fmtWeeks(p.eta.weeks)) + "</span></div>" +
      (rows.length ? '<ul class="mats">' + rows.map(function (r) {
        return '<li class="mrow" style="--catc:' + UI.catColor(r.cat) + '"><span>' + UI.matIcon(r.name, r.cat, 20) + "</span>" +
          '<span class="nm">' + esc(r.name) + "</span><span class=\"need\">need " + r.want + "</span>" +
          '<span class="need">have ' + r.have + '</span><span class="gap no">−' + r.miss + "</span></li>";
      }).join("") + "</ul>" : "") +
      '<a class="btn sm gold" style="margin-top:10px" href="tracker.html#wc-' + UI.slug(name) + '">Open in Tracking Center →</a></div>';
  }
  function openSheet(name) {
    var c = F.byName(name); if (!c) return;
    var b = c.build || {}, tn = D.talents && D.talents[name];
    var er = G ? G.erOf(name) : (D.erTarget && D.erTarget[name]);
    var gs = G ? G.statsFor(name) : null;
    var art = b.art || (gs && gs.set ? [gs.set, gs.mainsRaw, gs.subs] : null);
    var on = UI.isTracked(name), owned = UI.isOwned(name);
    UI.$("#sheetBox").innerHTML =
      '<div class="modalhead"><div style="display:flex;gap:13px;align-items:center">' + UI.avatar(name, 64) +
      "<div><h2>" + esc(name) + " " + UI.stars(c.r) + "</h2>" +
      '<div class="dim" style="font-size:12.5px">' + UI.elTag(c) + " · " + esc(c.w) + " · " + esc(c.reg || "") + " · since " + esc(c.ver || "") + "</div>" +
      '<div style="font-size:13.5px;margin-top:3px">' + esc(c.role || "") + "</div></div></div>" +
      '<button class="xbtn" data-close="#sheet" aria-label="Close">✕</button></div>' +
      '<div class="rowline" style="margin-bottom:12px"><span>' + ((c.tags || []).map(function (t) { return '<span class="badge plain">' + esc(t) + "</span>"; }).join(" ") || "") + "</span>" +
      "<span>" + [er ? "ER target <b class=\"mono\">" + er[0] + "–" + er[1] + "%</b>" : (G && G.noEnergy(name) ? "no Energy needed" : ""),
        tn ? esc(tn.join(" / ")) : ""].filter(Boolean).join(" · ") + "</span></div>" +
      '<div class="rowline" style="margin-bottom:12px"><span style="display:flex;gap:7px;flex-wrap:wrap">' +
      (on ? '<a class="btn sm" href="tracker.html#wc-' + UI.slug(name) + '">✓ Tracking — open centre</a> ' +
            '<button class="btn sm ghost" data-act="track" data-name="' + esc(name) + '">Stop tracking</button> '
          : '<button class="btn sm gold" data-act="track" data-name="' + esc(name) + '">＋ Track this character</button> ') +
      '<button class="btn sm ghost" data-act="own" data-name="' + esc(name) + '">' + (owned ? "★ Owned" : "☆ Mark owned") + "</button>" +
      '<a class="btn sm ghost" href="builder.html?t=' + encodeURIComponent(name) + '">Try in team builder</a></span></div>' +
      "<div class=\"build\">" +
      weaponRows(b.bis, "Best in slot") +
      weaponRows(b.alt5, "Other 5★ worth using") +
      weaponRows(b.four, "4★ picks") +
      weaponRows(b.free, "Free / craftable") +
      (art ? "<h4>Artifact for " + esc(D.version) + "</h4>" + setIcons(art) +
        "<ul>" + art.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (gs && UI.statBlock ? '<h4>Stat targets <span class="dim" style="text-transform:none;letter-spacing:0">(what to aim for)</span></h4>' + UI.statBlock(name) : "") +
      (b.prem && b.prem.length ? "<h4>Premium partners</h4>" + matePills(b.prem) : "") +
      (b.budget && b.budget.length ? "<h4>Budget partners</h4>" + matePills(b.budget) : "") +
      (b.tip ? "<h4>How it actually plays</h4><p style=\"font-size:13px;color:#cfdcf3\">" + esc(b.tip) + "</p>" : "") +
      (G && UI.rotLine ? '<h4>In a rotation <span class="dim" style="text-transform:none;letter-spacing:0">(what to press)</span></h4>' + UI.rotLine(name) +
        '<p class="dim" style="font-size:12px;margin:8px 0 0">The <a href="builder.html?t=' + encodeURIComponent(name) + '">team builder</a> turns this into a full step-by-step rotation once you add their teammates.</p>' : "") +
      matLines(name) +
      "</div>" + owedBlock(name);
    UI.openModal("#sheet");
    UI.$("#sheetBox").scrollTop = 0;
  }

  /* ---------- patch brief ---------- */
  var BRIEF = [
    { h: "The engines 7.2 is built around", ul: [
      "<b>Stellar-Conduct</b> (Cryo + Electro) replaces Superconduct only with a <b>Stellar Linchpin</b> on the team: Sandrone, Odette, Cryo Traveler — and now <b>Mitya</b>.",
      "<b>Stellar Swirl</b> (Cryo + Anemo) needs the same enabler and erupts for AoE Cryo; re-triggering raises its level.",
      "<b>Radiance states</b> upgrade certain talents and constellations inside a Polestar Field (Yae Miko, Qiqi, Diona, Wriothesley, Cyno, Mizuki).",
      "<b>Lunar reactions</b> from Nod-Krai stay alive: Bloom (Lauma/Nefer), Charged (Flins/Ineffa), Crystallize (Zibai/Linnea) — all enabled by Columbina.",
      "Rule of thumb: Stellar and Lunar damage ignore elemental DMG% goblets. Build ATK%/EM/DEF% goblets."
    ] },
    { h: "Banners and new kit", ul: [
      "<b>Phase 1</b> (Nov 4–24): Mitya 5★ debut, Furina rerun, Valeriy 4★ boosted on both banners.",
      "<b>Phase 2</b> (Nov 24–Dec 15): Zibai and Linnea double rerun; Starsealed Edict on the Epitome Invocation.",
      "<b>Natlan Chronicled Wish</b>: Varesa, Chasca, Xilonen, Mualani, Kinich — one designated 5★.",
      "<b>New map</b>: eastern Snezhnaya (Novokitezhgrad, Wingspan Peak, Old Kitezhgrad), Archon Quest VII V–VI, 560 Primogems, free 4★ event.",
      "<b>New boss</b>: Wavebinder — the source of Mitya's ascension material."
    ] },
    { h: "Sets the patch recommends", ul: [
      "<b>Disenchantment in Deep Shadow</b> — the default Stellar-Conduct set: +40% reaction DMG, +16% CRIT Rate.",
      "<b>Heart of the Furnace</b> — party-wide Stellar Glimmer DMG; the support-side set (Odette and friends).",
      "<b>Scarlet Proof</b> — offensive 7.x reaction set for carries and Anemo drivers such as Vesna.",
      "<b>Night of the Sky's Unveiling / Silken Moon's Serenade / Aubade of Morningstar and Moon</b> — the Lunar trio.",
      "<b>A Day Carved From Rising Winds / Celestial Gift</b> — the Hexerei carry and support sets."
    ] }
  ];
  function renderBrief(open) {
    var wrap = UI.$("#patchWrap"), box = UI.$("#patchBrief");
    if (wrap) wrap.hidden = !open;
    if (!open || !box) return;
    box.innerHTML = BRIEF.map(function (p) {
      return '<div><h4 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold)">' + p.h + "</h4>" +
        "<ul style=\"margin:0;padding-left:18px;color:#cfdcf3;font-size:13px\">" + p.ul.map(function (li) { return "<li style=\"margin-bottom:7px\">" + li + "</li>"; }).join("") + "</ul></div>";
    }).join("");
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (ev) {
    var chip = ev.target.closest("[data-f]");
    if (chip) {
      var k = chip.getAttribute("data-f"), v = chip.getAttribute("data-v");
      if (k === "clear") { f.q = ""; UI.$("#q").value = ""; ["el", "w", "r", "cat"].forEach(function (x) { f[x] = "all"; }); f.owned = f.tracked = false; }
      else if (k === "owned" || k === "tracked") f[k] = !f[k];
      else f[k] = f[k] === v ? "all" : v;
      chips(); filterGrid();
      return;
    }
    var act = ev.target.closest("[data-act]");
    if (!act) return;
    var name = act.getAttribute("data-name");
    var a = act.getAttribute("data-act");
    if (a === "track") {
      ev.stopPropagation();
      var now = UI.toggle(name);
      UI.toast(now ? "Tracking <b>" + esc(name) + "</b> — set it up in the Tracking Center" : "Stopped tracking <b>" + esc(name) + "</b>", now ? "" : "warn");
      chips(); syncCardEl(_gridNodes[name], F.byName(name)); syncCardEl(_featNodes[name], F.byName(name));
      if (f.tracked) filterGrid();
      renderPreview();
      if (UI.$("#sheet").classList.contains("open")) { openSheet(name); }
    } else if (a === "own") {
      ev.stopPropagation();
      var ownNow = UI.toggleOwned(name);
      UI.toast(ownNow ? "Marked <b>" + esc(name) + "</b> as owned" : "Removed <b>" + esc(name) + "</b> from owned", ownNow ? "" : "warn");
      chips(); syncCardEl(_gridNodes[name], F.byName(name)); syncCardEl(_featNodes[name], F.byName(name));
      if (f.owned) filterGrid();
      if (UI.$("#sheet").classList.contains("open")) { openSheet(name); }
    } else if (a === "open") {
      openSheet(name);
    }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.key === " ") {
      var card = ev.target.closest && ev.target.closest('[data-act="open"]');
      if (card) { ev.preventDefault(); openSheet(card.getAttribute("data-name")); }
    }
  });
  UI.$("#q").addEventListener("input", UI.debounce(function () {
    f.q = UI.$("#q").value.trim();
    chips();
    filterGrid();
  }, 40));
  UI.$("#btnJumpRoster").addEventListener("click", function () { UI.$("#roster").scrollIntoView({ behavior: "smooth", block: "start" }); });
  var patchOpen = false;
  UI.$("#btnPatch").addEventListener("click", function () {
    patchOpen = !patchOpen;
    this.textContent = patchOpen ? "Hide patch notes" : "Full patch notes";
    this.setAttribute("aria-expanded", String(patchOpen));
    renderBrief(patchOpen);
  });
  document.addEventListener("forge:watch", function () { syncAllCards(); filterGrid(); renderPreview(); chips(); });

  /* ---------- boot ---------- */
  renderBrief(false);
  chips(); filterGrid(); renderPreview(); UI.syncNav();

  var want = new URLSearchParams(location.search).get("c");
  if (want) {
    var bySlug = D.chars.filter(function (c) { return UI.slug(c.n) === want; })[0];
    if (bySlug) setTimeout(function () { openSheet(bySlug.n); }, 60);
  }
})();

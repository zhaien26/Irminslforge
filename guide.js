/* ==========================================================================
   Irminsul Forge — guide data: STAT TARGETS and ROTATIONS
   Pure data + logic, no DOM. Loaded after data.js / forge-core.js on every
   page, and by the node tests (test/guide.test.mjs).

   Two questions a new player always asks, answered per character and per team:
     1. "What stats does this character need?"  -> statsFor(name)
     2. "Who do I press, in what order?"        -> rotation([four names])

   How to edit
   -----------
   STAT[name]  { hp|atk|def|em|cr|cd: [minimum, goal], x: [[label, min, goal]],
                 er: [low, high]  (only to override erTarget in data.js),
                 noER: 1          (the character does not use Energy at all),
                 ms: "Sands / Goblet / Circlet", sub: "substat priority",
                 set: "artifact set"   (ms / sub / set are only needed when the
                 character has no build sheet in data.js), n: "one-line note" }
               Numbers are what the in-game character screen shows at Lv.90
               with a Lv.90 weapon and +20 artifacts, outside combat.

   ROT[name]   { p: phase, a: "actions", t: seconds on field, up: seconds the
                 effect lasts, d: "what it does / why now" }
               p decides the order:  1.x  long-lasting setup (shields, turrets)
                                     2.x  off-field element application
                                     3.x  short buffs / shred (cast last)
                                     4.x  off-field damage that copies buffs
                                     5    the on-field carry
               a is space-separated; "_" inside a token prints as a space.
                 E / hE = tap / hold Skill, Q = Burst, N = Normal Attack,
                 CA = Charged Attack, P = plunge, Aim = aimed shot, ×3 = repeat.
               Optional: w   { "Bennett": "sentence added when he is a teammate" }
                         pre { a, t, d }  an early step for a carry
                         alt { p, a, t, up, d }  what they do when someone else carries
                         altWhen "bloom"  use alt when the team has Dendro + Hydro
               Flags: na (needs the active character's Normal Attacks),
                 vv (a Swirl support that shreds RES), drv (how good an on-field
                 driver they are), noNA (a carry that barely Normal Attacks).
   ========================================================================== */
(function (root, factory) {
  var api = factory(root.FORGE || (typeof require === "function" ? require("./data.js") : {}));
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeGuide = api;
})(typeof self !== "undefined" ? self : this, function (DATA) {
  "use strict";

  var CHARS = DATA.chars || [];
  var ER = DATA.erTarget || {};
  var BY = {};
  CHARS.forEach(function (c) { BY[c.n] = c; });

  /* =======================================================================
     1. STAT TARGETS
     ======================================================================= */
  var STAT = {
    /* ---------- Snezhnaya / Stellar ---------- */
    "Mitya": { em: [450, 750], cr: [55, 70], cd: [140, 200], n: "He scales on Elemental Mastery, not ATK or Electro DMG%. 4pc Disenchantment adds +16% CRIT Rate on top of the number you see." },
    "Valeriy": { atk: [2000, 2500], n: "His shield scales on ATK, not HP. CRIT Rate (40–50%) only matters if he carries a Favonius weapon." },
    "Vesna": { atk: [2000, 2400], cr: [60, 75], cd: [140, 200], n: "2,000 ATK caps her party Stellar Swirl bonus; ATK past that is still personal damage. An Anemo DMG goblet does nothing for her." },
    "Vodyanitsa": { hp: [45000, 65000], n: "Healing and buffs scale on Max HP and cap near 65,000. She needs no CRIT at all." },
    "Odette": { atk: [1900, 2400], cr: [60, 75], cd: [130, 190], n: "She works off-field and her ER need is low — spend the substats on CRIT and ATK%." },
    "Alyosha": { atk: [1400, 1800], n: "Healing scales on ATK. Reach the ER target first; CRIT Rate (40–50%) only with a Favonius Lance." },
    "Traveler (Cryo)": { atk: [1700, 2100], cr: [55, 70], cd: [120, 170], n: "Lower base stats than a limited 5★, so the targets are lower too. As an off-field Linchpin, ER matters more than CRIT." },
    "Sandrone": { atk: [1900, 2400], cr: [55, 70], cd: [150, 210], n: "ATK% goblet, not Cryo DMG% — her reaction damage ignores it. 4pc Disenchantment adds +16% CRIT Rate in combat." },

    /* ---------- Nod-Krai / Lunar ---------- */
    "Columbina": { hp: [28000, 36000], cr: [55, 70], cd: [130, 180], n: "ER comes first: she must Burst every loop to keep the Lunar Domain up. HP and CRIT after that." },
    "Zibai": { def: [2000, 2600], cr: [60, 75], cd: [160, 220], n: "She scales on DEF — ignore ATK completely, even on the weapon." },
    "Linnea": { def: [2000, 2600], n: "Her Geo RES shred, Lunar-Crystallize bonus and healing all scale on DEF. CRIT is optional." },
    "Lauma": { em: [800, 1100], n: "Hit the ER target first, then pour everything into Elemental Mastery — her EM raises Lunar-Bloom damage for the whole team." },
    "Nefer": { em: [500, 800], cr: [55, 70], cd: [170, 230], n: "EM on sands and goblet; CRIT comes from the circlet and substats." },
    "Flins": { atk: [1900, 2400], cr: [60, 75], cd: [180, 240], n: "The goblet is ATK% or EM — Lunar-Charged damage ignores Electro DMG%." },
    "Ineffa": { atk: [1900, 2400], cr: [60, 75], cd: [130, 180], n: "Her shield and her Lunar-Charged contribution both scale on ATK." },
    "Illuga": { em: [600, 850], n: "He needs about 185% ER at C0 before EM matters — his bonus scales on EM, but only if his skills are actually up." },
    "Jahoda": { em: [150, 400], n: "ER is the only hard requirement: her job is healing and being a Moonsign body." },
    "Aino": { em: [350, 550], n: "ER first so the Burst is always up, EM after. CRIT only matters with a Favonius Greatsword (~45% CRIT Rate)." },

    /* ---------- Hexerei ---------- */
    "Varka": { atk: [1800, 2300], cr: [65, 80], cd: [170, 230], n: "Classic carry stats: keep roughly 1 CRIT Rate for every 2 CRIT DMG." },
    "Durin": { atk: [1700, 2100], cr: [65, 80], cd: [150, 210], n: "Off-field damage dealer — a standard ATK / Pyro / CRIT build." },
    "Nicole": { atk: [2400, 3000], n: "Her ATK buff scales on her own ATK: ATK% on sands, goblet and circlet. No CRIT needed." },
    "Lohen": { atk: [1800, 2300], cr: [60, 75], cd: [170, 230], n: "On-field carry — keep roughly 1 CRIT Rate for every 2 CRIT DMG." },
    "Prune": { em: [600, 850], n: "Her Swirls scale on EM; ER so her Burst is ready every loop." },

    /* ---------- everyone else with a build sheet ---------- */
    "Furina": { hp: [30000, 40000], cr: [60, 75], cd: [130, 180], n: "Max HP is her attack stat (HP% sands and goblet). Golden Troupe supplies most of her Skill damage." },
    "Yae Miko": { atk: [1700, 2200], cr: [65, 80], cd: [140, 190], n: "Her passive also turns EM into Skill damage, so EM substats are not wasted." },
    "Qiqi": { atk: [1800, 2400], n: "Healing scales on ATK. No CRIT needed unless she holds a Favonius Sword." },
    "Diona": { hp: [24000, 30000], n: "Shield and healing scale on Max HP. A Sacrificial or Favonius bow makes her ER target much easier." },
    "Beidou": { atk: [1100, 1500], cr: [50, 65], cd: [100, 140], n: "ER first — without her Burst she does nothing. A second Electro (Fischl) makes her far easier to fund." },
    "Fischl": { atk: [1600, 2000], cr: [60, 75], cd: [120, 170], n: "Oz does the damage: ATK% sands, Electro goblet, CRIT circlet. She rarely needs extra ER." },
    "Wriothesley": { atk: [1700, 2100], cr: [45, 60], cd: [190, 240], n: "Marechaussee Hunter adds +36% CRIT Rate in combat (Disenchantment +16%), so 45–60% on the screen is enough." },
    "Cyno": { atk: [1300, 1800], em: [100, 350], cr: [65, 80], cd: [190, 240], n: "ATK sands or EM sands both work — the more reactions the team makes, the better EM gets." },
    "Mizuki": { em: [800, 1000], n: "Full EM. Her Swirls and her EM share are the whole kit." },
    "Escoffier": { atk: [1700, 2200], cr: [65, 80], cd: [150, 200], n: "Her healing and her damage both scale on ATK." },
    "Skirk": { atk: [1800, 2300], cr: [60, 75], cd: [200, 260], noER: 1, n: "She uses Serpent's Subtlety instead of Energy, so ER substats do nothing for her." },
    "Bennett": { hp: [20000, 26000], x: [["Base ATK", 640, 800]], n: "His ATK buff uses BASE ATK only (his level + the sword's base ATK). Artifacts cannot raise it — level him and a high-base-ATK sword to 90." },
    "Xiangling": { atk: [1100, 1500], em: [100, 200], cr: [55, 70], cd: [110, 160], n: "ER first. Her Burst copies Bennett's ATK buff, so her own ATK matters less than it looks." },
    "Xingqiu": { atk: [1100, 1600], cr: [55, 70], cd: [100, 150], n: "ER first: a Sacrificial Sword or a second Hydro teammate puts you at the low end of the ER target." },
    "Kazuha": { em: [750, 950], n: "Every point of EM is +0.04% Elemental DMG for the team (800 EM = +32%). No CRIT needed." },
    "Sucrose": { em: [650, 900], n: "She gives the team 20% of her own EM (plus 50). Triple EM pieces, nothing else." },
    "Zhongli": { hp: [38000, 50000], n: "Shield strength scales on Max HP: HP% on all three pieces. ER and CRIT are optional." },
    "Raiden Shogun": { atk: [1300, 1900], cr: [55, 70], cd: [110, 160], n: "ER is also damage for her: Emblem turns 25% of ER into Burst DMG and her passive adds Electro DMG per ER." },
    "Nahida": { em: [700, 1000], cr: [40, 60], cd: [100, 150], n: "1,000 EM caps her own passive; her Burst shares up to 250 EM with the on-field character." },
    "Neuvillette": { hp: [28000, 38000], cr: [40, 55], cd: [200, 260], n: "Max HP is his attack stat. Marechaussee Hunter adds +36% CRIT Rate in combat, so ~45% on the screen is plenty." },
    "Mavuika": { atk: [1800, 2300], cr: [45, 60], cd: [200, 260], noER: 1, n: "4pc Obsidian Codex adds +40% CRIT Rate while she burns Nightsoul. Her Burst runs on Fighting Spirit, not Energy — skip ER." },
    "Citlali": { em: [600, 950], n: "Her shield and off-field damage scale on EM. The high end of the ER target is for casting her Burst every loop." },
    "Arlecchino": { atk: [1700, 2200], cr: [65, 80], cd: [190, 240], n: "She barely needs ER — her Burst is mostly a heal and reset button." },
    "Chasca": { atk: [2000, 2500], cr: [50, 60], cd: [180, 240], n: "4pc Obsidian Codex adds +40% CRIT Rate while she fires. ATK% goblet — her shells are mixed elements." },
    "Mualani": { hp: [28000, 36000], cr: [50, 60], cd: [170, 230], n: "She scales on Max HP. Obsidian Codex adds +40% CRIT Rate; every bite should Vaporize." },
    "Kinich": { atk: [1700, 2200], cr: [45, 60], cd: [200, 250], n: "4pc Obsidian Codex adds +40% CRIT Rate during his Skill." },
    "Xilonen": { def: [2800, 3400], n: "Her healing and damage scale on DEF; the RES shred itself is flat. Triple DEF% pieces." },
    "Varesa": { atk: [1700, 2200], cr: [50, 65], cd: [170, 230], n: "4pc Obsidian Codex adds +40% CRIT Rate. Her special Burst is cheap, so ER can stay low." },
    "Faruzan": { cr: [40, 60], n: "Before C6 she is all Energy Recharge — hit the ER target before anything else. CRIT Rate is only for a Favonius Warbow." },
    "Iansan": { atk: [2000, 2500], n: "Her ATK buff grows with her own ATK and caps at roughly 2,500. ER so the Burst is always ready." },
    "Chevreuse": { hp: [30000, 40000], n: "40,000 Max HP maxes her ATK buff (+1% per 1,000 HP). She only works in Pyro + Electro teams." },

    /* ---------- characters without a build sheet: set / main stats / substats live here ---------- */
    "Jean": { atk: [1500, 2000], cr: [50, 65], cd: [100, 150], set: "4pc Viridescent Venerer", ms: "ATK% or ER / Anemo DMG% or ATK% / CRIT Rate or Healing Bonus", sub: "ER > CRIT > ATK%", n: "Healing scales on ATK. With a Favonius Sword, 50%+ CRIT Rate matters more than CRIT DMG." },
    "Venti": { em: [500, 800], set: "4pc Viridescent Venerer", ms: "EM or ER / EM / EM", sub: "ER > EM", n: "ER first so the Burst is up every loop — it is his whole value." },
    "Wanderer": { atk: [1700, 2200], cr: [65, 80], cd: [160, 210], set: "4pc Desert Pavilion Chronicle", ms: "ATK% / Anemo DMG% or ATK% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "With Faruzan the goblet can be ATK%. He needs a shield or he gets knocked out of the air." },
    "Xiao": { atk: [1700, 2200], cr: [70, 85], cd: [170, 220], set: "4pc Vermillion Hereafter or 4pc Long Night's Oath", ms: "ATK% / Anemo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "No Burst means no damage: reach the ER target (the low end with Faruzan C6 or a second Anemo)." },
    "Xianyun": { atk: [2600, 3400], set: "4pc Song of Days Past or 4pc Viridescent Venerer", ms: "ATK% or ER / ATK% / ATK%", sub: "ER > ATK%", n: "Her healing and the plunge bonus both scale on ATK. No CRIT needed." },
    "Lan Yan": { atk: [1900, 2500], er: [140, 180], set: "4pc Viridescent Venerer", ms: "ATK% / ATK% / ATK%", sub: "ATK% > ER", n: "Shield strength scales on ATK. Her Burst is optional, so ER is flexible." },
    "Sayu": { em: [450, 750], set: "4pc Viridescent Venerer", ms: "EM or ER / EM / EM", sub: "ER > EM > ATK%", n: "Healing scales on ATK and EM; EM also powers her Swirls." },
    "Heizou": { atk: [1400, 1800], em: [80, 250], cr: [60, 75], cd: [130, 180], set: "4pc Viridescent Venerer", ms: "ATK% / Anemo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > EM", n: "An on-field Anemo carry who still shreds with Viridescent Venerer." },
    "Lynette": { atk: [1100, 1500], cr: [55, 70], cd: [110, 160], set: "4pc Viridescent Venerer", ms: "ATK% or ER / Anemo DMG% / CRIT Rate", sub: "ER > CRIT > ATK%", n: "A free 4★ for every player. ER so the Bogglecat Box is always out." },
    "Ifa": { em: [650, 900], set: "4pc Viridescent Venerer", ms: "EM / EM / EM", sub: "EM > ER", n: "His healing scales on EM, and so do his own Swirls." },
    "Albedo": { def: [1800, 2400], cr: [60, 75], cd: [130, 180], set: "4pc Husk of Opulent Dreams or 4pc Golden Troupe", ms: "DEF% / Geo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > DEF%", n: "His flower scales on DEF. He almost never needs his Burst, so ER is optional." },
    "Navia": { atk: [1800, 2300], cr: [60, 80], cd: [180, 230], set: "4pc Nighttime Whispers in the Echoing Woods", ms: "ATK% / Geo DMG% or ATK% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "Her Skill is the damage; ER only has to cover the Burst every other loop." },
    "Chiori": { def: [1800, 2300], cr: [65, 85], cd: [150, 200], set: "4pc Golden Troupe or 4pc Husk of Opulent Dreams", ms: "DEF% / Geo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > DEF% > ATK%", n: "She scales on DEF first and ATK second. Her Burst is optional." },
    "Itto": { def: [2000, 2600], cr: [65, 80], cd: [170, 220], set: "4pc Husk of Opulent Dreams", ms: "DEF% / Geo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > DEF% > ER", n: "DEF is his attack stat (his Burst converts DEF into ATK). He must Burst every loop — mind the ER." },
    "Noelle": { def: [1800, 2300], cr: [55, 70], cd: [110, 160], set: "4pc Husk of Opulent Dreams", ms: "DEF% / Geo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > DEF% > ER", n: "DEF powers her shield, her healing and (in Burst) her ATK. She needs her Burst to be a carry." },
    "Ningguang": { atk: [1400, 1800], cr: [60, 75], cd: [130, 180], set: "4pc Nighttime Whispers in the Echoing Woods or 2pc Archaic Petra + 2pc ATK%", ms: "ATK% / Geo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "A straightforward ATK / Geo / CRIT carry." },
    "Gorou": { cr: [45, 60], set: "4pc Noblesse Oblige or 4pc The Exile", ms: "ER / DEF% / CRIT Rate or DEF%", sub: "ER > CRIT Rate (Favonius)", n: "His buff does not scale on his own stats. ER (plus a Favonius Warbow) is the whole build." },
    "Yun Jin": { def: [1900, 2500], set: "4pc Husk of Opulent Dreams or 4pc Noblesse Oblige", ms: "ER or DEF% / DEF% / DEF%", sub: "ER > DEF%", n: "Her Normal Attack bonus scales on DEF, but only if the Burst is ready — ER first." },
    "Kachina": { def: [1400, 1900], cr: [50, 65], cd: [100, 150], set: "4pc Scroll of the Hero of Cinder City", ms: "DEF% / Geo DMG% / CRIT Rate", sub: "ER > CRIT > DEF%", n: "Mostly a Cinder City holder: her own stats matter less than keeping Turbo Twirly out." },
    "Keqing": { atk: [1600, 2100], em: [80, 200], cr: [60, 75], cd: [180, 230], set: "4pc Thundering Fury", ms: "ATK% / Electro DMG% / CRIT Rate", sub: "CRIT > ATK% > EM", n: "CRIT DMG is her ascension stat, so the circlet is usually CRIT Rate. EM helps in Aggravate teams." },
    "Clorinde": { atk: [1800, 2300], cr: [70, 85], cd: [170, 220], set: "4pc Fragment of Harmonic Whimsy or 4pc Thundering Fury", ms: "ATK% / Electro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > EM", n: "Her passive adds flat damage from ATK (it caps near 3,000 ATK in combat)." },
    "Sethos": { em: [300, 500], cr: [60, 75], cd: [150, 200], set: "4pc Wanderer's Troupe", ms: "EM / Electro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > EM > ATK%", n: "His charged shots add a big slice of EM as damage — EM sands, not ATK%." },
    "Kujou Sara": { x: [["Base ATK", 640, 800]], cr: [50, 65], set: "4pc Noblesse Oblige", ms: "ER / Electro DMG% or ATK% / CRIT Rate", sub: "ER > CRIT", n: "Her buff uses BASE ATK only — a Lv.90 high-base-ATK bow matters more than any artifact." },
    "Kuki Shinobu": { em: [750, 950], set: "4pc Flower of Paradise Lost or 4pc Gilded Dreams (Hyperbloom) · 4pc Tenacity of the Millelith (healer)", ms: "EM / EM / EM", sub: "EM > HP%", n: "In Hyperbloom only her EM and her LEVEL scale the damage — take her to Lv.90. As a pure healer, build HP% instead." },
    "Dori": { hp: [24000, 30000], set: "4pc Noblesse Oblige or 4pc Tenacity of the Millelith", ms: "ER / HP% / HP% or Healing Bonus", sub: "ER > HP%", n: "Healing scales on Max HP, and nothing works without the Burst." },
    "Ororon": { atk: [1100, 1500], cr: [55, 70], cd: [110, 160], set: "4pc Scroll of the Hero of Cinder City", ms: "ATK% or ER / Electro DMG% / CRIT Rate or CRIT DMG", sub: "ER > CRIT > ATK%", n: "Usually a Cinder City holder — ER and CRIT Rate (Favonius) before raw damage." },
    "Razor": { atk: [1400, 1900], cr: [60, 75], cd: [120, 170], set: "2pc Pale Flame + 2pc Bloodstained Chivalry", ms: "ATK% / Physical DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "A Physical carry: the goblet is Physical DMG%, not Electro." },
    "Lisa": { atk: [1100, 1500], cr: [55, 70], cd: [110, 160], set: "4pc Emblem of Severed Fate or 4pc Thundering Fury", ms: "ATK% or ER / Electro DMG% / CRIT Rate", sub: "ER > CRIT > ATK%", n: "Her Burst cuts enemy DEF by 15% — ER keeps that up." },
    "Alhaitham": { atk: [1200, 1500], em: [300, 450], cr: [65, 80], cd: [150, 220], set: "4pc Gilded Dreams or 4pc Deepwood Memories", ms: "EM / Dendro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > EM > ATK% > ER", n: "His mirror hits scale on both ATK and EM — EM sands is the usual pick." },
    "Tighnari": { atk: [1200, 1600], em: [150, 350], cr: [65, 80], cd: [160, 210], set: "4pc Wanderer's Troupe or 4pc Gilded Dreams", ms: "EM or ATK% / Dendro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > EM > ATK%", n: "His passive turns EM into Charged Attack and Burst damage." },
    "Emilie": { atk: [1900, 2400], cr: [65, 80], cd: [170, 220], set: "4pc Unfinished Reverie", ms: "ATK% / Dendro DMG% / CRIT Rate", sub: "CRIT > ATK% > ER", n: "2,400 ATK maxes her passive's bonus against Burning enemies." },
    "Baizhu": { hp: [38000, 50000], set: "4pc Deepwood Memories or 4pc Ocean-Hued Clam", ms: "HP% or ER / HP% / HP% or Healing Bonus", sub: "ER > HP%", n: "50,000 Max HP caps the reaction bonus from his passive." },
    "Collei": { cr: [45, 60], set: "4pc Deepwood Memories", ms: "ER or EM / Dendro DMG% or EM / CRIT Rate", sub: "ER > CRIT Rate > EM", n: "A Deepwood holder and Dendro applier: ER (and Favonius CRIT Rate) is what matters." },
    "Yaoyao": { hp: [28000, 35000], set: "4pc Deepwood Memories or 4pc Tenacity of the Millelith", ms: "HP% or ER / HP% / HP% or Healing Bonus", sub: "ER > HP%", n: "Healing scales on Max HP." },
    "Kaveh": { em: [650, 900], set: "4pc Flower of Paradise Lost or 4pc Deepwood Memories", ms: "EM / EM / EM", sub: "ER > EM", n: "He owns the Bloom damage, so EM (and his level) is everything — after enough ER for the Burst." },
    "Kirara": { hp: [32000, 40000], set: "4pc Deepwood Memories or 4pc Tenacity of the Millelith", ms: "HP% / HP% / HP%", sub: "HP% > ER", n: "Shield strength scales on Max HP." },
    "Nilou": { hp: [50000, 70000], set: "2pc Tenacity of the Millelith + 2pc Vourukasha's Glow (any two HP% sets)", ms: "HP% / HP% / HP%", sub: "HP% > ER > EM", n: "Every 1,000 HP above 30,000 boosts the team's Bountiful Cores (it caps near 75,000 HP)." },
    "Kokomi": { hp: [32000, 40000], set: "4pc Ocean-Hued Clam or 4pc Tenacity of the Millelith", ms: "HP% / Hydro DMG% or HP% / Healing Bonus", sub: "HP% > ER", n: "She cannot CRIT (−100% CRIT Rate): never spend substats or the circlet on CRIT." },
    "Ayato": { atk: [1600, 2100], cr: [65, 80], cd: [190, 240], set: "4pc Echoes of an Offering or 4pc Heart of Depth", ms: "ATK% / Hydro DMG% / CRIT Rate", sub: "CRIT > ATK% > HP%", n: "CRIT DMG is his ascension stat, so the circlet is usually CRIT Rate." },
    "Yelan": { hp: [26000, 33000], cr: [70, 85], cd: [150, 200], set: "4pc Emblem of Severed Fate", ms: "HP% / Hydro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > HP% > ER", n: "Her damage scales on Max HP, not ATK. ER first if she is the only Hydro." },
    "Mona": { atk: [1100, 1500], cr: [55, 70], cd: [100, 150], set: "4pc Emblem of Severed Fate or 4pc Noblesse Oblige", ms: "ER / Hydro DMG% / CRIT Rate", sub: "ER > CRIT", n: "Her passive turns 20% of her ER into Hydro DMG% — ER is never wasted on her." },
    "Sigewinne": { hp: [42000, 55000], set: "4pc Song of Days Past or 4pc Tenacity of the Millelith", ms: "HP% / HP% / HP%", sub: "HP% > ER", n: "Her healing and her off-field Skill buff both scale on Max HP." },
    "Barbara": { hp: [24000, 30000], set: "4pc Ocean-Hued Clam or 4pc Maiden Beloved", ms: "HP% / HP% / Healing Bonus", sub: "HP% > ER", n: "Healing scales on Max HP. Free at Adventure Rank 18 — a perfectly good first healer." },
    "Candace": { hp: [25000, 32000], set: "4pc Noblesse Oblige or 4pc Emblem of Severed Fate", ms: "ER or HP% / HP% / HP% or CRIT Rate", sub: "ER > HP%", n: "Her Normal Attack bonus grows with Max HP (+0.5% per 1,000 HP)." },
    "Dahlia": { hp: [28000, 36000], set: "4pc Noblesse Oblige or 4pc Tenacity of the Millelith", ms: "ER or HP% / HP% / HP%", sub: "ER > HP%", n: "Shield strength scales on Max HP; the attack-speed buff needs his Burst up." },
    "Tartaglia": { atk: [1600, 2000], em: [80, 150], cr: [65, 80], cd: [150, 200], set: "4pc Nymph's Dream or 4pc Heart of Depth", ms: "ATK% / Hydro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > EM", n: "A standard ATK / Hydro / CRIT carry; a little EM helps his Vaporizes." },
    "Hu Tao": { hp: [28000, 35000], em: [80, 250], cr: [60, 75], cd: [200, 250], set: "4pc Crimson Witch of Flames or 4pc Shimenawa's Reminiscence", ms: "HP% or EM / Pyro DMG% / CRIT Rate", sub: "CRIT > HP% > EM", n: "Her Skill converts Max HP into ATK, so build HP — not ATK%. She barely needs ER." },
    "Klee": { atk: [1600, 2000], cr: [60, 75], cd: [130, 180], set: "4pc Crimson Witch of Flames", ms: "ATK% / Pyro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > EM", n: "A standard ATK / Pyro / CRIT carry." },
    "Diluc": { atk: [1600, 2100], em: [80, 200], cr: [70, 85], cd: [150, 200], set: "4pc Crimson Witch of Flames", ms: "ATK% or EM / Pyro DMG% / CRIT DMG", sub: "CRIT > ATK% > EM", n: "CRIT Rate is his ascension stat, so the circlet is usually CRIT DMG." },
    "Yoimiya": { atk: [1800, 2200], em: [60, 150], cr: [70, 85], cd: [160, 210], set: "4pc Shimenawa's Reminiscence", ms: "ATK% / Pyro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > EM", n: "With Shimenawa she skips her Burst, so ER hardly matters." },
    "Lyney": { atk: [1700, 2200], cr: [45, 60], cd: [190, 250], set: "4pc Marechaussee Hunter", ms: "ATK% / Pyro DMG% / CRIT DMG", sub: "CRIT > ATK%", n: "Marechaussee Hunter adds +36% CRIT Rate in combat, so ~50% on the screen is plenty." },
    "Dehya": { hp: [26000, 34000], cr: [50, 65], cd: [100, 150], set: "4pc Tenacity of the Millelith or 4pc Emblem of Severed Fate", ms: "HP% or ER / Pyro DMG% or HP% / CRIT Rate", sub: "ER > CRIT > HP%", n: "As an off-field Pyro applier and tank, HP and ER matter more than damage." },
    "Thoma": { hp: [22000, 28000], set: "4pc Emblem of Severed Fate or 4pc Noblesse Oblige", ms: "ER / HP% / HP%", sub: "ER > HP%", n: "His shield scales on Max HP, but it only stacks while the Burst is up — ER first. (Burgeon Thoma is full EM instead.)" },
    "Yanfei": { atk: [1400, 1800], em: [80, 150], cr: [60, 75], cd: [130, 180], set: "4pc Crimson Witch of Flames or 4pc Wanderer's Troupe", ms: "ATK% / Pyro DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > EM", n: "Charged Attacks are her damage — Wanderer's Troupe works because she is a catalyst user." },
    "Gaming": { atk: [1600, 2100], em: [80, 250], cr: [45, 60], cd: [150, 200], set: "4pc Marechaussee Hunter", ms: "ATK% or EM / Pyro DMG% / CRIT DMG", sub: "CRIT > ATK% > EM > ER", n: "Marechaussee Hunter adds +36% CRIT Rate (his plunge costs HP, his Skill heals). He needs his Burst — mind the ER." },
    "Amber": { atk: [1300, 1700], cr: [55, 70], cd: [110, 160], set: "4pc Noblesse Oblige or 4pc Emblem of Severed Fate", ms: "ATK% or ER / Pyro DMG% / CRIT Rate", sub: "ER > CRIT > ATK%", n: "Her Burst is the damage; ER keeps it available." },
    "Xinyan": { atk: [1300, 1700], cr: [50, 65], cd: [100, 150], set: "2pc Pale Flame + 2pc Bloodstained Chivalry or 4pc Noblesse Oblige", ms: "ATK% or ER / Physical DMG% / CRIT Rate", sub: "ER > CRIT > ATK%", n: "Her shield scales on DEF but her damage on ATK; as a support, ER and Favonius matter most." },
    "Ayaka": { atk: [1800, 2200], cr: [30, 45], cd: [200, 250], set: "4pc Blizzard Strayer", ms: "ATK% / Cryo DMG% / CRIT DMG", sub: "CRIT DMG > ATK% > ER > CRIT Rate", n: "Blizzard Strayer + Cryo resonance add up to +55% CRIT Rate against Frozen enemies — the number on the screen can stay low." },
    "Ganyu": { atk: [1800, 2300], cr: [30, 45], cd: [200, 250], set: "4pc Blizzard Strayer (Freeze) or 4pc Wanderer's Troupe (Melt)", ms: "ATK% / Cryo DMG% / CRIT DMG", sub: "CRIT DMG > ATK% > CRIT Rate", n: "In Freeze, the set, the resonance and her own passive give her CRIT Rate. For Melt aim for 50–60% CRIT Rate and some EM." },
    "Eula": { atk: [1700, 2300], cr: [60, 75], cd: [170, 220], set: "4pc Pale Flame or 2pc Pale Flame + 2pc Bloodstained Chivalry", ms: "ATK% / Physical DMG% / CRIT Rate", sub: "CRIT > ATK% > ER", n: "A Physical carry: Physical DMG% goblet. Her Burst is most of her damage, so do not skip ER." },
    "Shenhe": { atk: [2800, 3600], set: "4pc Noblesse Oblige or 2pc + 2pc ATK% sets", ms: "ATK% or ER / ATK% / ATK%", sub: "ER > ATK%", n: "Each Icy Quill adds a slice of her ATK to Cryo hits — stack ATK%, skip CRIT." },
    "Rosaria": { atk: [1300, 1800], cr: [65, 80], cd: [100, 150], set: "4pc Noblesse Oblige or 4pc Emblem of Severed Fate", ms: "ATK% or ER / Cryo DMG% / CRIT Rate", sub: "CRIT Rate > ER > ATK%", n: "She shares 15% of her CRIT Rate with the team (max +15%), so CRIT Rate beats CRIT DMG on her." },
    "Chongyun": { atk: [1400, 1800], cr: [55, 70], cd: [110, 160], set: "4pc Noblesse Oblige or 4pc Blizzard Strayer", ms: "ATK% / Cryo DMG% / CRIT Rate or CRIT DMG", sub: "ER > CRIT > ATK%", n: "His Burst is the damage; the Skill field is the utility." },
    "Kaeya": { atk: [1300, 1700], cr: [55, 70], cd: [110, 160], set: "4pc Emblem of Severed Fate or 4pc Blizzard Strayer", ms: "ATK% / Cryo DMG% / CRIT Rate or CRIT DMG", sub: "ER > CRIT > ATK%", n: "A free starter character. ER is his ascension stat, so the target is easy to reach." },
    "Mika": { hp: [24000, 30000], set: "4pc Noblesse Oblige or 4pc Tenacity of the Millelith", ms: "ER / HP% / HP% or Healing Bonus", sub: "ER > HP%", n: "Healing scales on Max HP; the attack-speed buff is flat." },
    "Charlotte": { atk: [1800, 2400], set: "4pc Noblesse Oblige or 4pc Ocean-Hued Clam", ms: "ATK% or ER / ATK% / ATK% or Healing Bonus", sub: "ER > ATK%", n: "Healing scales on ATK. CRIT Rate only with a Favonius Codex." },
    "Layla": { hp: [30000, 38000], set: "4pc Tenacity of the Millelith", ms: "HP% / HP% / HP%", sub: "HP% > ER", n: "Shield strength scales on Max HP. Her Burst is optional." },
    "Freminet": { atk: [1500, 1900], cr: [55, 70], cd: [130, 180], set: "2pc Pale Flame + 2pc Bloodstained Chivalry", ms: "ATK% / Physical DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "Mostly Physical damage — use a Physical DMG% goblet." },
    "Aloy": { atk: [1400, 1800], cr: [45, 60], cd: [130, 180], set: "4pc Blizzard Strayer", ms: "ATK% / Cryo DMG% / CRIT Rate or CRIT DMG", sub: "CRIT > ATK% > ER", n: "In Freeze teams Blizzard Strayer adds up to +40% CRIT Rate." }
  };

  var STAT_META = {
    hp: { label: "Max HP", unit: "" },
    atk: { label: "ATK", unit: "" },
    def: { label: "DEF", unit: "" },
    em: { label: "Elemental Mastery", unit: "" },
    cr: { label: "CRIT Rate", unit: "%" },
    cd: { label: "CRIT DMG", unit: "%" },
    er: { label: "Energy Recharge", unit: "%" }
  };
  var STAT_ORDER = ["hp", "atk", "def", "em", "cr", "cd"];
  var STAT_LEGEND = "The big number is the minimum for the character to do their job; “goal” is a comfortable endgame build. " +
    "Compare them with the in-game character screen (Lv.90, Lv.90 weapon, +20 artifacts, outside combat). They are guidelines, not hard gates.";
  var STAT_EARLY = "Below Adventure Rank 45? Do not chase these yet — level the character, the weapon and the talents, " +
    "wear the right main stats, and come back once 5★ artifacts drop reliably.";
  var STAT_SHORT = "Targets assume Lv.90, a Lv.90 weapon and +20 artifacts. Not there yet? Wear the right main stats and keep levelling.";
  var ER_HINT = "Energy Recharge is a range: the low end is enough with a “battery” (a teammate of the same element who feeds them energy) " +
    "or a Favonius weapon; aim for the high end without.";

  function fmtStat(v, unit) {
    if (v == null || v === "") return "—";
    var n = Number(v);
    if (!isFinite(n)) return "—";
    if (unit === "%") return (Math.round(n * 10) / 10) + "%";
    return Math.round(n).toLocaleString("en-US");
  }
  function noEnergy(name) { return !!(STAT[name] && STAT[name].noER); }
  function erOf(name) {
    var s = STAT[name];
    if (s && s.noER) return null;
    return (s && s.er) || ER[name] || null;
  }

  /* statsFor("Hu Tao") -> everything the UI needs to draw the stat block */
  function statsFor(name) {
    var c = BY[name], s = STAT[name];
    if (!c || !s) return null;
    var rows = [];
    (s.x || []).forEach(function (x, i) {
      rows.push({ key: "x" + i, label: x[0], min: x[1], goal: x[2], unit: x[3] || "" });
    });
    STAT_ORDER.forEach(function (k) {
      if (!s[k]) return;
      rows.push({ key: k, label: STAT_META[k].label, min: s[k][0], goal: s[k][1], unit: STAT_META[k].unit });
    });
    var er = erOf(name);
    if (er) rows.push({ key: "er", label: STAT_META.er.label, min: er[0], goal: er[1], unit: "%", range: true, hint: ER_HINT });
    else if (s.noER) rows.push({ key: "er", label: STAT_META.er.label, none: true, hint: "This character does not use Energy." });
    var art = (c.build && c.build.art) || [];
    var mainsRaw = s.ms || art[1] || "";
    var parts = mainsRaw.split(" / ");
    return {
      name: name, rows: rows,
      mains: parts.length === 3 ? { sands: parts[0], goblet: parts[1], circlet: parts[2] } : null,
      mainsRaw: mainsRaw,
      subs: s.sub || art[2] || "",
      set: s.set || art[0] || "",
      fromGuide: !art.length,
      note: s.n || "",
      legend: STAT_LEGEND, early: STAT_EARLY
    };
  }

  /* how does one number compare with its target?  none | below | ok | great */
  function checkStat(row, value) {
    if (!row || row.none) return "none";
    if (value == null || value === "" || !isFinite(Number(value))) return "none";
    var v = Number(value);
    if (v >= row.goal) return "great";
    if (v >= row.min) return "ok";
    return "below";
  }
  /* statScore("Hu Tao", { hp: 31000, cr: 58 }) -> per-row verdicts + a tally */
  function statScore(name, mine) {
    var s = statsFor(name);
    if (!s) return null;
    mine = mine || {};
    var met = 0, entered = 0, total = 0;
    var rows = s.rows.map(function (r) {
      var v = mine[r.key];
      var status = checkStat(r, v);
      if (!r.none) total++;
      if (status !== "none") entered++;
      if (status === "ok" || status === "great") met++;
      return {
        key: r.key, label: r.label, min: r.min, goal: r.goal, unit: r.unit, hint: r.hint, range: !!r.range, none: !!r.none,
        value: status === "none" ? null : Number(v), status: status,
        gap: status === "below" ? Math.round((r.min - Number(v)) * 10) / 10 : 0
      };
    });
    return { name: name, rows: rows, met: met, entered: entered, total: total, complete: total > 0 && met === total };
  }

  /* =======================================================================
     2. ROTATIONS — one profile per character
     ======================================================================= */
  var ROT = {
    /* ---------- Pyro ---------- */
    "Bennett": { p: 3.2, a: "Q E", t: 2, up: 12, drv: 4, d: "His Burst circle heals and adds ATK to whoever stands inside it — fight inside the circle. It lasts 12s." },
    "Xiangling": { p: 4, a: "Q E", t: 2.5, up: 10, drv: 3, w: { "Bennett": "Press Q while she is standing in Bennett's circle." }, d: "Pyronado spins around your active character for about 10s and keeps the buffs she had at the moment you pressed Q. Then drop Guoba." },
    "Hu Tao": { p: 5, a: "E N→CA_×8 Q", t: 9, d: "Skill starts a 9s stance: one Normal Attack into a Charged Attack, over and over (dash or jump to cancel the recovery). Burst at the end to heal back." },
    "Klee": { p: 5, a: "E×2 Q N→CA_×5", t: 8, d: "Both bombs, Burst (it only works while she is on field), then Normal → Charged Attack combos." },
    "Diluc": { p: 5, a: "E→N_×3 Q N×4", t: 9, d: "His Skill has three slashes — put one Normal Attack between each. The Burst gives his sword Pyro for the rest of the window." },
    "Yoimiya": { p: 5, a: "E N×5_×3", t: 9, d: "Skill turns her Normal Attacks into Pyro arrows for 10s: do full 5-shot strings and do not dash. Her Burst is optional." },
    "Lyney": { p: 5, a: "Aim×2 Q E Aim×2", t: 10, noNA: 1, d: "Fully charge the Aimed Shot (second glow) to drop Grin-Malkin Hats; his Skill blows them up. Give him a shield or he gets interrupted." },
    "Dehya": { p: 1.5, a: "E", t: 1, up: 12, d: "Fiery Sanctum hits off-field with Pyro and absorbs damage for the active character for 12s. Press E again to move it before it ends." },
    "Thoma": { p: 1.5, a: "E Q", t: 2.5, up: 15, na: 1, d: "With the Burst up, every Normal Attack from the active character adds a shield layer and a Pyro hit." },
    "Yanfei": { p: 5, a: "E CA Q CA N×3→CA_×3", t: 9, d: "Skill and Burst each fill her Scarlet Seals — fire a Charged Attack right after each. Otherwise three Normal Attacks build the seals for the next Charged Attack." },
    "Gaming": { p: 5, a: "Q E→P_×4", t: 9, noNA: 1, d: "Burst first (it summons Man Chai and heals). Each Skill dash launches him into a Pyro plunge; catching Man Chai resets the Skill." },
    "Amber": { p: 2, a: "Q E", t: 2, up: 8, d: "Burst for damage, then Baron Bunny to pull enemy attention away from you." },
    "Xinyan": { p: 1.5, a: "E Q", t: 2.5, up: 12, d: "Her Skill shield is strongest when it hits two or more enemies. The Burst is a quick Physical hit." },
    "Arlecchino": { p: 5, a: "CA N×6_×2 Q", t: 10, pre: { a: "E", t: 1, d: "Mark enemies with her Skill first. The marks need about 5 seconds to mature — exactly the time your supports need to set up." }, d: "Charged Attack to absorb the matured marks (this powers up her attacks), then Normal Attack strings. Healers cannot heal her — only her own Burst can." },
    "Mavuika": { p: 5, a: "Q CA×6", t: 8, noNA: 1, pre: { a: "E", t: 1, d: "Tap Skill: the Ring of Searing Radiance follows your active character and hits off-field while your supports set up." }, d: "Burst once Fighting Spirit is full (teammates' Nightsoul skills and Normal Attacks fill it), then ride the bike: Charged Attack spins until the buff ends (~7s)." },
    "Durin": { p: 3, a: "E Q", t: 2.5, d: "Skill, then Burst: he keeps dealing Pyro damage off-field and shreds enemy RES. He works best next to another Hexerei teammate." },
    "Nicole": { p: 3.2, a: "E Q", t: 2.5, d: "Skill and Burst: a Pyro shield, an ATK buff scaled on her own ATK, and coordinated attacks. Cast them right before your carry takes the field." },
    "Chevreuse": { p: 3.2, a: "hE Q", t: 2.5, up: 30, d: "Hold Skill after an Overload has happened to fire the buffed shot (party ATK up). Her RES shred triggers by itself whenever the team Overloads." },

    /* ---------- Hydro ---------- */
    "Xingqiu": { p: 2, a: "E Q", t: 3, up: 15, na: 1, drv: 1, d: "Rain swords orbit the active character and fire Hydro every time they Normal Attack. With a Sacrificial Sword, press E again when it resets." },
    "Yelan": { p: 2.2, a: "Q E", t: 2.5, up: 15, na: 1, d: "Her dice fire along with the active character's Normal Attacks and raise their damage the longer they stay on field." },
    "Furina": { p: 1, a: "E Q", t: 2.5, up: 18, d: "Her three Salon members hit off-field for 30s. The Burst turns every HP change in the team into DMG% — pair her with someone who heals the whole team." },
    "Kokomi": { p: 1.5, a: "E", t: 1.5, up: 12, drv: 8, d: "The jellyfish heals and applies Hydro for 12s. If she is your on-field character: Burst, then Normal Attack to heal everyone." },
    "Mona": { p: 3.9, a: "E Q", t: 2, up: 5, d: "Her Burst's Omen makes the enemy take more damage for only about 5 seconds — hit with your biggest attack immediately after." },
    "Barbara": { p: 1.5, a: "E", t: 1, up: 15, drv: 5, d: "Melody Loop heals on a timer and whenever she Normal Attacks. It also makes your character Wet — careful around Cryo enemies." },
    "Candace": { p: 3.2, a: "E Q", t: 2.5, up: 9, d: "Her Burst gives sword, claymore and polearm users a Hydro infusion and stronger Normal Attacks for 9s." },
    "Dahlia": { p: 3.1, a: "E Q", t: 2.5, d: "His Burst shields the active character and raises attack speed — made for Normal Attack carries." },
    "Tartaglia": { p: 5, a: "E N×2→CA_×6 Q E", t: 10, d: "Skill switches to melee: two Normal Attacks into a Charged Attack, repeated, to spread Riptide. Press E again to leave within ~10s or the cooldown gets very long." },
    "Ayato": { p: 5, a: "Q E N×15", t: 8, d: "Burst first (it boosts Normal Attacks inside it), then Skill and hold Normal Attack for the whole 6s stance." },
    "Neuvillette": { p: 5, a: "E Q CA×3", t: 10, noNA: 1, d: "Skill and Burst create Sourcewater Droplets. Hold Charged Attack near them to fire the beam instantly, and turn the camera to sweep it across enemies." },
    "Mualani": { p: 5, a: "E N×3 Q", t: 9, d: "Skill puts her on the shark: touch enemies to stack 3 Wave Momentum, then Normal Attack to bite. Repeat for about three bites. Each bite should hit an enemy that has Pyro on it." },
    "Nilou": { p: 1.2, a: "E E×3 Q", t: 3.5, up: 12, d: "Press the Skill, then three more times: the last step leaves a water ring (Tranquility Aura) that keeps applying Hydro around the active character. It only works in a Dendro + Hydro team." },
    "Sigewinne": { p: 1.5, a: "hE", t: 2.5, d: "Hold Skill to grow the bubble: it bounces between enemies, heals the team and buffs off-field Skill damage." },
    "Columbina": { p: 1.3, a: "E Q", t: 2.5, d: "Skill for off-field Hydro; her Burst opens the Lunar Domain — Burst every loop and fight inside it. She is what switches the Lunar reactions on." },
    "Vodyanitsa": { p: 3.1, a: "E Q", t: 2.5, d: "Skill and Burst: she heals, shreds Hydro and Cryo RES (Anemo too while a Stellar Vortex exists) and buffs ATK. Cast them right before the carry." },
    "Aino": { p: 2, a: "E Q", t: 2.5, d: "Her Burst keeps Hydro raining off-field. Her whole job is feeding Hydro into your reaction and being a Moonsign body." },

    /* ---------- Electro ---------- */
    "Fischl": { p: 1.6, a: "E", t: 1, up: 10, drv: 1, d: "Oz shoots Electro off-field for 10–12s. Trick: summon him with the Skill one loop and with the Burst the next, so he is always out." },
    "Beidou": { p: 4, a: "Q E", t: 2, up: 15, na: 1, w: { "Bennett": "Press Q while she is standing in Bennett's circle — the lightning keeps that buff." }, d: "Her Burst throws chain lightning whenever the active character Normal Attacks. Her Skill is a counter: tap it right as an enemy hits you." },
    "Raiden Shogun": { p: 5, a: "Q N×3→CA_×3", t: 7, altWhen: "bloom",
      pre: { a: "E", t: 1, d: "Skill first: the Eye of Stormy Judgment adds off-field Electro for 25s and makes everyone's Burst hit harder." },
      alt: { p: 1.05, a: "E", t: 1, up: 25, d: "Just the Skill: the Eye of Stormy Judgment zaps off-field for 25s (in Dendro + Hydro teams this is what triggers Hyperbloom). Her Burst refills the team's energy — use it at the end of a loop when Bursts are running dry." },
      d: "Her Burst goes LAST — it gets stronger for every Burst your teammates cast before it, and her attacks refill their energy." },
    "Yae Miko": { p: 1.6, a: "E×3 Q", t: 4, d: "Plant three Sesshou Sakura — they zap off-field — then Burst. After her Witch's Revelation quest the Burst no longer destroys them and they last 10s longer." },
    "Kuki Shinobu": { p: 1.8, a: "E", t: 1, up: 12, drv: 3, d: "The Grass Ring follows the active character: it heals, and hits nearby enemies and Dendro Cores with Electro (Hyperbloom). Stay close to the cores." },
    "Keqing": { p: 5, a: "E Q E N→CA_×4", t: 8, d: "Throw the Stiletto, Burst, then press E again to blink to it — that gives her Electro attacks for 5s — and do Normal → Charged strings." },
    "Clorinde": { p: 5, a: "E N×3→E_×3 Q", t: 9, d: "Skill enters the pistol stance: three shots, then E to lunge — repeat until the stance ends, then Burst." },
    "Cyno": { p: 5, a: "Q E N×5_+_E", t: 15, d: "His Burst is a long stance (~18s): Normal Attack, and press E the moment the eye icon flashes for extra bolts. He hogs the field, so his supports need long-lasting skills." },
    "Sethos": { p: 5, a: "E Aim×3 Q N×8", t: 9, d: "Skill for energy, then level-2 Aimed Shots (they scale on EM). The Burst turns his Normal Attacks into piercing shots." },
    "Kujou Sara": { p: 3.8, a: "E Aim Q", t: 3, up: 6, d: "Skill, then a fully charged shot drops her ATK buff where it lands — it lasts only 6s, so swap straight to your carry. The Burst applies the buff again." },
    "Dori": { p: 1.8, a: "E Q", t: 2.5, up: 12, d: "The Burst lamp tethers to the active character: it heals and feeds them energy. Stay near the lamp." },
    "Ororon": { p: 2, a: "E Q", t: 2.5, up: 9, d: "Skill bounces between enemies for particles; the Burst zone keeps hitting off-field." },
    "Razor": { p: 5, a: "E Q N×4_loop", t: 12, d: "His Burst lasts 15s and ends the moment you swap out, so stay on field and keep attacking. Use E whenever it is ready." },
    "Lisa": { p: 3, a: "hE Q", t: 3.5, up: 15, drv: 4, d: "Her Burst zone zaps nearby enemies and cuts their DEF by 15%. Only hold the Skill once enemies have three Conductive stacks." },
    "Iansan": { p: 3.2, a: "E Q", t: 2.5, up: 15, d: "Her Burst puts a Kinetic Energy Scale on the active character that adds ATK. It is strongest while that character keeps moving and attacking." },
    "Varesa": { p: 5, a: "E P CA P E P Q", t: 9, noNA: 1, d: "Skill dash → plunge; Charged Attack leaps → plunge again. At full Nightsoul she enters Fiery Passion: plunge once more, then press Burst for the cheap, strong version." },
    "Flins": { p: 5, a: "E E→Q N×4 E→Q", t: 10, d: "Skill enters his spear form. Inside it, pressing E again is Northland Spearstorm, which makes the next Burst very cheap — chain Spearstorm → Burst, with Normal Attacks in between." },
    "Ineffa": { p: 1.5, a: "E Q", t: 2.5, up: 20, d: "Skill summons Birgitta: a shield plus off-field Electro hits that keep Lunar-Charged going. The Burst summons her again." },
    "Mitya": { p: 5, a: "E N_/_CA Q", t: 10,
      alt: { p: 2.1, a: "E Q", t: 3, d: "Skill and Burst, then swap out. As a Linchpin he keeps Stellar-Conduct switched on for whoever carries." },
      d: "Skill him in, then spend his Gradient Beacons — Detection Core in the Steady state, Gradient Detonation in the Overload state. Burst when it is up, and keep a Polestar Field alive under your feet." },
    "Valeriy": { p: 3.3, a: "E CA Q", t: 3.5, d: "Skill banks Impact Potential; then his special Charged Attack (Mortar Fire) turns it into Assault Command stacks — the Electro / Stellar-Conduct buff for whoever is on field. He is also your shield." },
    "Alyosha": { p: 3.1, a: "E Q", t: 2.5, d: "Skill, then Burst: he heals, and casting the Burst switches on his team buff — so do it right before the carry's damage window." },

    /* ---------- Cryo ---------- */
    "Ayaka": { p: 5, a: "Dash E Q N×2→CA_×3", t: 7, d: "Sprint first — it puts Cryo on her sword. Skill, then aim the Burst so the blizzard stays on Frozen enemies (an enemy that can still walk will leave it)." },
    "Ganyu": { p: 5, a: "E Q Aim×5", t: 9, noNA: 1, d: "Her Burst keeps raining Cryo even after she swaps out. Then fully charged Aimed Shots — wait for the second glow before releasing." },
    "Eula": { p: 5, a: "E Q N×4 hE N×4", t: 9, d: "Tap Skill, Burst, four Normal hits, HOLD Skill, four more hits. The Lightfall Sword explodes after ~7s — if you swap out early you lose it." },
    "Shenhe": { p: 3.3, a: "E Q", t: 2.5, up: 10, d: "Tap Skill hands out Icy Quills that add damage to Cryo hits; the Burst field lowers Cryo RES. Only Cryo damage benefits." },
    "Rosaria": { p: 2.5, a: "E Q", t: 2.5, up: 8, drv: 3, d: "Her Burst lance pulses Cryo off-field and shares part of her CRIT Rate with the team." },
    "Chongyun": { p: 2.5, a: "E Q", t: 2.5, up: 10, d: "His Skill field gives sword, claymore and polearm users Cryo attacks — great for some carries, bad for others (it overrides Physical)." },
    "Kaeya": { p: 2.5, a: "Q E", t: 2.5, up: 8, drv: 3, d: "Three icicles circle the active character. Stay right next to enemies so they keep getting hit." },
    "Diona": { p: 1.4, a: "hE Q", t: 3, up: 12, d: "Hold Skill for the bigger shield; the Burst field heals and applies Cryo. After her Witch's Revelation (C6) it also boosts Stellar-Conduct for anyone inside." },
    "Qiqi": { p: 1.5, a: "E Q", t: 2.5, up: 15, d: "Herald of Frost heals the active character as they attack (after her Witch's Revelation it adds Cryo hits too). The Burst talisman heals whoever hits the marked enemy." },
    "Layla": { p: 1.4, a: "E", t: 1, up: 12, d: "Curtain of Slumber shield. Shooting stars fire on their own while the shield holds." },
    "Mika": { p: 3.2, a: "E Q", t: 2.5, up: 12, d: "Skill gives attack speed (and Physical DMG); the Burst heals whenever the active character's Normal Attacks hit." },
    "Charlotte": { p: 1.6, a: "hE Q", t: 3, d: "Her Burst field heals the whole team at once. Hold the Skill to mark several enemies with the camera." },
    "Freminet": { p: 5, a: "Q E→N×3_×3", t: 9, d: "Burst resets his Skill and speeds it up. After each Skill thrust, Normal Attacks build pressure — press E again to shatter it." },
    "Aloy": { p: 5, a: "E Q N×4_loop", t: 8, d: "Her bomblets stack Coil; at four stacks her Normal Attacks turn Cryo for 10s." },
    "Wriothesley": { p: 5, a: "E N×5→CA_×3 Q", t: 10, d: "Skill powers up his punches for 10s (it drains HP). Do 5-hit strings, and Charged Attack whenever his fist glows — that punch heals him." },
    "Escoffier": { p: 1.7, a: "E Q", t: 2.5, up: 20, d: "Her cooking mek fires Cryo off-field and her passive shreds Cryo and Hydro RES; the Burst heals the team." },
    "Skirk": { p: 5, a: "E Q N×5_×3", t: 10, d: "Tap Skill to enter Seven-Phase Flash and press Burst inside it (it absorbs Void Rifts for stronger hits), then 5-hit Normal Attack strings. Keep enemies Frozen." },
    "Citlali": { p: 3, a: "E Q", t: 2.5, up: 20, d: "Skill gives the shield and summons Itzpapa. Whenever the team triggers Melt or Frozen, enemies lose Pyro and Hydro RES. The Burst is extra Cryo damage." },
    "Odette": { p: 2, a: "E Q", t: 2.5, d: "Skill and Burst put her Cryo on the field from off-field — the Cryo half of Stellar-Conduct and Stellar Swirl — together with her Stellar Glimmer buff." },
    "Sandrone": { p: 5, a: "E Q CA×6", t: 10, noNA: 1, d: "Skill and Burst, then hold the field with Charged Attacks — the ones through Fagio are her damage. She needs Electro on the enemy to make Stellar-Conduct." },
    "Traveler (Cryo)": { p: 5, a: "E N→CA_×4 Q", t: 8,
      alt: { p: 2.1, a: "E Q", t: 2.5, d: "Skill for Cryo, Burst when Frostglow is stacked, then swap out. As the free Linchpin they keep Stellar-Conduct switched on." },
      d: "Charged Attack combos build Frostglow stacks; spend them with the Burst. As the free Linchpin they switch on Stellar-Conduct for the team." },
    "Lohen": { p: 5, a: "N→CA_×4 E Q", t: 9, d: "Your own Normal and Charged Attacks build Joy — spend it on the Skill nuke (Piercing Frost). Your teammates' off-field damage builds Triumph — spend that on the Burst." },

    /* ---------- Anemo ---------- */
    "Kazuha": { p: 3.6, a: "E P Q", t: 3, up: 8, vv: 1, drv: 6, d: "Skill launches him: plunge to Swirl, then Burst. His Elemental DMG buff lasts 8s, so go straight to your carry." },
    "Sucrose": { p: 3.6, a: "E", t: 1.5, up: 8, vv: 1, drv: 9, d: "One Skill Swirl shares her Elemental Mastery with the team for 8s and shreds RES (Viridescent Venerer). Her Burst is a bonus." },
    "Venti": { p: 3.5, a: "E Q", t: 2.5, up: 8, vv: 1, d: "His Burst vacuums small enemies and absorbs one element. Cast it on top of the group, then unload inside it." },
    "Jean": { p: 3.4, a: "E Q", t: 2.5, up: 10, vv: 1, drv: 4, d: "Her Burst heals the whole team instantly, and the field keeps Swirling whatever element touches it." },
    "Xiao": { p: 5, a: "E×2 Q Jump→P_×10", t: 12, noNA: 1, d: "Both Skill charges, Burst, then jump and plunge non-stop for about 15s. The mask drains his HP — bring a healer." },
    "Wanderer": { p: 5, a: "E N→CA_×6 Q", t: 10, d: "Skill makes him hover for about 10s: attack from the air, and dash only when you must (it burns hover time). Burst just before he lands." },
    "Xianyun": { p: 3.3, a: "E P Q", t: 3.5, up: 16, vv: 1, d: "Leap with the Skill and plunge to Swirl, then Burst: for 16s everyone can jump high and plunge for bonus damage, and the team gets healed." },
    "Lan Yan": { p: 1.4, a: "E N", t: 2, up: 12, vv: 1, d: "Skill gives the shield (dash through an enemy's element and it converts), then one Normal Attack throws the feather to Swirl." },
    "Sayu": { p: 1.6, a: "E Q", t: 2.5, up: 12, vv: 1, d: "Her Burst doll heals or attacks nearby on its own. Hold the Skill to roll through enemies and Swirl." },
    "Heizou": { p: 5, a: "N×4 hE Q", t: 8, vv: 1, d: "Normal Attacks stack Declension (max 4) — then release a fully stacked hold-Skill punch. That punch is his damage." },
    "Lynette": { p: 2.6, a: "E Q", t: 2.5, up: 12, vv: 1, drv: 4, d: "Her Bogglecat Box absorbs an element and fires it off-field for 12s." },
    "Ifa": { p: 1.7, a: "E N×3 Q", t: 4, vv: 1, drv: 5, d: "Skill lets him hover and fire tonic shots that heal the team; the Burst groups enemies up." },
    "Faruzan": { p: 3.2, a: "Q E Aim", t: 3, up: 12, d: "Her Burst adds Anemo DMG and lowers Anemo RES for 12s. Then Skill and one charged shot to pull enemies in and get energy back. If the Burst is not ready, do the Skill part and move on." },
    "Chasca": { p: 5, a: "E hN×4 Q", t: 10, noNA: 1, d: "Skill mounts her flying gun: HOLD Normal Attack to load six shells (they copy your teammates' Pyro / Hydro / Cryo / Electro), release to fire. Repeat until Nightsoul runs out." },
    "Mizuki": { p: 4.5, a: "E Q", t: 6, vv: 1, drv: 8, noNA: 1,
      alt: { p: 3.6, a: "E Q", t: 4, d: "Skill to float through the enemies and Swirl, Burst, then swap to your carry." },
      d: "Skill puts her in Dreamdrifter: she floats and Swirls non-stop, so just steer her into enemies. The Burst drops snacks that heal or attack." },
    "Varka": { p: 5, a: "E Q N_/_CA", t: 10, d: "Skill and Burst, then hold the field with his attack strings. He wants a second Hexerei teammate for the Secret Rite bonus." },
    "Vesna": { p: 5, a: "E Q N×4_×3", t: 10, d: "She stays on field and Swirls the Cryo your off-fielders apply, turning it into Stellar Swirl. No Cryo on the enemy means no Stellar Swirl — keep it applied." },
    "Prune": { p: 3.6, a: "E Q", t: 2.5, vv: 1, drv: 6, d: "Swirl with Skill and Burst for the Viridescent Venerer shred. She also counts as a Hexerei body for Secret Rite." },
    "Jahoda": { p: 1.7, a: "E Q", t: 2.5, vv: 1, d: "Skill and Burst for healing. She also counts as a Moonsign character, which is what turns on Ascendant Gleam." },

    /* ---------- Geo ---------- */
    "Zhongli": { p: 1, a: "hE", t: 1.5, up: 20, d: "Hold Skill for a 20s shield that also lowers the RES of nearby enemies by 20%. Refresh it before it runs out; Burst whenever it is ready." },
    "Albedo": { p: 1.2, a: "E", t: 1, up: 30, d: "His flower lasts 30s and pulses whenever your attacks hit an enemy standing in it — place it where the fight is." },
    "Chiori": { p: 1.3, a: "E", t: 1.5, up: 17, d: "Skill drops her doll; press E again during the dash to swap instantly to the next character. She needs another Geo teammate for the second doll." },
    "Navia": { p: 5, a: "Q E N×4 E", t: 8, d: "Walk over Crystallize shards before you shoot: each Skill shot is stronger with up to six of them. Normal Attacks between the two shots are Geo-infused." },
    "Itto": { p: 5, a: "E Q N×4 hCA", t: 11, d: "Throw Ushi, Burst, four Normal hits to stack Superlative Strength, then HOLD Charged Attack to spend all the stacks. Repeat until the Burst ends." },
    "Noelle": { p: 5, a: "E Q N×4_loop", t: 12, d: "Shield first, then Burst: 15s of wide Geo swings whose hits heal the whole team." },
    "Ningguang": { p: 5, a: "E Q N×2→CA_×4", t: 8, d: "Place the Jade Screen first (it adds gems to the Burst), Burst, then two Normal Attacks into a Charged Attack." },
    "Gorou": { p: 3.2, a: "E Q", t: 2.5, up: 10, d: "His banner gives DEF (and Geo DMG with three Geo characters). Stand in it — the Burst makes the banner follow you." },
    "Yun Jin": { p: 3.2, a: "E Q", t: 2.5, up: 12, d: "Her Burst adds flat damage to the team's next 30 Normal Attack hits (12s). Tap the Skill; the perfect-parry timing is a bonus." },
    "Kachina": { p: 1.5, a: "E", t: 1.5, d: "Summon Turbo Twirly and hop off: it keeps drilling off-field and keeps the Cinder City buff running." },
    "Xilonen": { p: 1.6, a: "E N×2 Q", t: 3, up: 15, d: "Skill puts her on blades; two Normal Attacks switch on her Source Samples — RES shred for 15s. The Burst heals." },
    "Zibai": { p: 5, a: "E Q N×4_×3", t: 10, d: "Skill and Burst, then Normal Attack strings to trigger Lunar-Crystallize. The reaction needs Hydro on the field — use your Hydro applier's Skill every time it is ready." },
    "Linnea": { p: 3.1, a: "E Q", t: 2.5, d: "Skill and Burst: she lowers Geo RES, raises Lunar-Crystallize damage and heals. The RES shred needs Ascendant Gleam, so bring another Moonsign teammate." },
    "Illuga": { p: 3.3, a: "E Q", t: 2.5, d: "Skill and Burst add bonus damage — scaled on his EM, like Shenhe's quills — to the team's Lunar-Crystallize hits. Cast them right before your carry." },

    /* ---------- Dendro ---------- */
    "Nahida": { p: 1.1, a: "hE Q", t: 3, up: 25, drv: 8, d: "Hold Skill and sweep the camera across every enemy to mark them for 25s. Marked enemies take Dendro whenever a reaction hits them; the Burst boosts it." },
    "Alhaitham": { p: 5, a: "Q E N×5_×2 CA", t: 10, d: "Open with the Burst at zero mirrors (you get three back), Skill in, then Normal Attack strings while the mirrors fire extra Dendro hits." },
    "Tighnari": { p: 5, a: "E Aim×3 Q", t: 5, noNA: 1, d: "His Skill gives three instant level-2 Aimed Shots: fire all three, Burst, swap out. A quick 5-second window." },
    "Emilie": { p: 1.3, a: "E Q", t: 2.5, up: 22, d: "Her Lumidouce Case attacks off-field for 22s and levels up while enemies are Burning. The Burst swaps it for a rapid-fire version." },
    "Baizhu": { p: 1.5, a: "E Q", t: 2.5, up: 14, d: "His Burst makes small shields that heal when they break, and boosts Dendro reactions for the active character." },
    "Collei": { p: 2, a: "E Q", t: 2.5, up: 6, d: "Boomerang, then the Cuilein-Anbar zone: off-field Dendro application." },
    "Yaoyao": { p: 1.5, a: "E", t: 1.5, up: 10, d: "Yuegui throws radishes that heal and apply Dendro off-field. Use the Burst only when you need a big heal." },
    "Kaveh": { p: 5, a: "E Q N×4_loop", t: 10, d: "His Burst gives him Dendro attacks and makes Bloom cores burst faster; his Skill pops every nearby core at once. He needs an off-field Hydro applier." },
    "Kirara": { p: 1.4, a: "E", t: 1.5, up: 12, d: "Tap Skill for the shield. Hold it to turn into the parcel-cat and roll over enemies to apply Dendro." },
    "Kinich": { p: 5, a: "E N×3→E_×3 Q", t: 10, noNA: 1, d: "Skill grapples onto an enemy: swing-shots (Normal Attack) fill Nightsoul, then press E again to fire the Scalespiker Cannon. Burning enemies fill it faster." },
    "Lauma": { p: 1.2, a: "E Q", t: 2.5, d: "Skill plants off-field Dendro and shreds RES; her Burst loads the stacks that boost every Bloom and Lunar-Bloom hit. Burst every loop — that is why she needs so much ER." },
    "Nefer": { p: 5, a: "E CA×4 Q", t: 10, noNA: 1, d: "Skill enters her dance stance; Charged Attacks then absorb the Dendro Cores on the field (Seeds of Deceit) for Lunar-Bloom damage. She needs Hydro on the enemy to keep making cores." }
  };

  /* team-specific advice for the lineups the builder offers as presets */
  var TEAM_NOTES = [
    { team: ["Mitya", "Valeriy", "Odette", "Sucrose"], notes: [
      "Stellar-Conduct needs Cryo AND Electro on the enemy. Odette is your only Cryo — never skip her step, and use her Skill again the moment it is back.",
      "Mitya scales on Elemental Mastery, so Sucrose goes right before him: her EM share only lasts 8s.",
      "Keep Mitya's Polestar Field alive and fight inside it."
    ] },
    { team: ["Mitya", "Valeriy", "Diona", "Fischl"], notes: [
      "Diona is the only Cryo source: fight inside her Burst field (at C6 it also adds +40% Stellar-Conduct DMG).",
      "Fischl: summon Oz with the Skill one loop and with the Burst the next, so Electro never drops.",
      "Only Mitya is a 5★ here. Everyone else is cheap to build, so spend your resin on him first."
    ] },
    { team: ["Sandrone", "Yae Miko", "Odette", "Alyosha"], notes: [
      "Sandrone's hits only become Stellar-Conduct while Electro is on the enemy — Yae's three turrets must be down before Sandrone starts swinging.",
      "Alyosha goes last among the supports: his buff starts when he casts his Burst.",
      "Yae Miko is the main Electro source. Re-plant her turrets the moment they expire."
    ] },
    { team: ["Vesna", "Odette", "Vodyanitsa", "Faruzan"], notes: [
      "Vesna converts Cryo Swirl into Stellar Swirl, so Cryo must stay on the enemy: Odette first, always.",
      "Vodyanitsa's Anemo RES shred only works while a Stellar Vortex exists — keep Vesna Swirling Cryo.",
      "Faruzan is very energy-hungry (240–280% ER before C6). If her Burst is not ready, use her Skill and move on."
    ] },
    { team: ["Skirk", "Furina", "Escoffier", "Vodyanitsa"], notes: [
      "Furina first: her Salon lasts 30s, and the healing from Escoffier and Vodyanitsa is what stacks her Burst's DMG bonus.",
      "Keep enemies Frozen (Hydro from Furina, Cryo from Skirk and Escoffier). Bosses that cannot be frozen still take the damage, just without the crowd control.",
      "Skirk uses Serpent's Subtlety instead of Energy, so she never waits on Energy Recharge."
    ] },
    { team: ["Nefer", "Lauma", "Columbina", "Sucrose"], notes: [
      "Lunar-Bloom = Dendro + Hydro. Lauma converts the reaction, Columbina supplies the Hydro and the Lunar Domain — both must Burst every loop.",
      "Anemo cannot Swirl Dendro: Sucrose Swirls the Hydro instead, and her job here is sharing Elemental Mastery with Nefer.",
      "Nefer eats the Dendro Cores on the field — do not start her window before the cores exist."
    ] },
    { team: ["Zibai", "Columbina", "Linnea", "Illuga"], notes: [
      "Lunar-Crystallize needs Hydro on the field: Columbina's Skill and Burst come first, every loop.",
      "Linnea's Geo RES shred needs Ascendant Gleam — that comes from Moonsign characters, and all four here are Moonsign.",
      "Illuga needs about 185% ER. If his skills are not ready, Zibai's window loses a large slice of damage — fix his ER before anything else."
    ] },
    { team: ["Flins", "Ineffa", "Columbina", "Sucrose"], notes: [
      "Lunar-Charged needs Hydro and Electro up at the same time: Columbina (Hydro) and Ineffa's Birgitta (Electro) must both be out before Flins starts.",
      "Sucrose Swirls Electro or Hydro right before Flins — her EM share lasts 8s.",
      "Inside his spear form, chain Skill → Burst: the Skill makes the next Burst cheap."
    ] },
    { team: ["Xiangling", "Xingqiu", "Bennett", "Sucrose"], notes: [
      "The whole trick: Bennett's circle, then Sucrose's Swirl, then Xiangling's Burst inside the circle. Pyronado keeps both buffs for its full 10 seconds.",
      "After that, stay on Sucrose and Normal Attack: that is what fires Xingqiu's rain swords and makes Pyronado Vaporize.",
      "Xiangling needs a lot of Energy Recharge. Use Bennett's Skill every time it is ready — it makes Pyro particles for her."
    ] },
    { team: ["Nahida", "Xingqiu", "Kuki Shinobu", "Yaoyao"], notes: [
      "Dendro + Hydro makes green Dendro Cores. Kuki's Electro ring hits each core and turns it into a homing Hyperbloom missile — that is the team's damage.",
      "Only Kuki's Elemental Mastery and level matter for Hyperbloom damage. Everyone else just has to apply their element.",
      "Stay close to enemies: the cores spawn next to them and Kuki's ring has a short reach."
    ] },
    { team: ["Sucrose", "Fischl", "Beidou", "Xingqiu"], notes: [
      "Everything is off-field here: Sucrose just Normal Attacks, and each hit triggers Xingqiu's swords and Beidou's lightning at once.",
      "Sucrose's Swirls spread Electro and Hydro to every nearby enemy — this team is strongest against groups.",
      "Beidou needs a lot of energy. Oz makes Electro particles: swap to Beidou for a second after Oz has been out a while to catch them."
    ] }
  ];
  var TEAM_INDEX = {};
  function teamKey(team) { return team.slice().sort().join("|"); }
  TEAM_NOTES.forEach(function (t) { TEAM_INDEX[teamKey(t.team)] = t; });

  /* beginner-friendly lineups the builder shows next to the 7.2 presets */
  var STARTERS = [
    { name: "Starter · National (all 4★)", team: ["Xiangling", "Xingqiu", "Bennett", "Sucrose"], starter: true,
      why: "The classic first real team: every piece is a 4★ and Xiangling is free. It teaches the one rule every rotation follows — buff first, then damage." },
    { name: "Starter · Hyperbloom", team: ["Nahida", "Xingqiu", "Kuki Shinobu", "Yaoyao"], starter: true,
      why: "The easiest strong team to play: apply Dendro and Hydro, let Kuki's ring do the damage. No Nahida? Collei or Kirara fills her slot." },
    { name: "Starter · Taser (all 4★)", team: ["Sucrose", "Fischl", "Beidou", "Xingqiu"], starter: true,
      why: "All 4★ and almost entirely off-field: Sucrose Normal Attacks while everything else fires by itself. Great against groups." }
  ];

  var PHASES = {
    setup: { label: "Setup", tip: "Lasts a long time — cast it first" },
    buff: { label: "Buff", tip: "A short buff — cast it right before the damage" },
    off: { label: "Off-field damage", tip: "Keeps hitting after you swap out, and keeps the buffs it was cast with" },
    carry: { label: "Main damage", tip: "Your damage dealer's turn on the field" },
    field: { label: "Stay on field", tip: "Stays out and keeps attacking so the off-field skills trigger" }
  };
  function phaseOf(p) { return p >= 4.5 ? "carry" : p >= 4 ? "off" : p >= 3 ? "buff" : "setup"; }

  var BASICS = [
    ["Setup first", "Skills that last a long time go first: shields, turrets, off-field elements. They keep working after you swap out."],
    ["Buffs last", "Most buffs only last 8–12 seconds, so cast them right before your damage dealer takes the field."],
    ["Then damage", "Your carry spends the next 8–10 seconds attacking while everything above is still running."],
    ["Repeat — and never wait", "Start again from step 1 in the same order. If a Burst is not ready, skip it and keep going."]
  ];
  var LEGEND = [
    ["E", "e", "Elemental Skill"], ["hE", "e", "hold the Skill"], ["Q", "q", "Elemental Burst"],
    ["N", "n", "Normal Attack"], ["CA", "n", "Charged Attack"], ["P", "n", "plunge"], ["Aim", "n", "charged bow shot"],
    ["×3", "n", "do it 3 times"], ["→", "n", "then"]
  ];

  function tokens(a) {
    return String(a || "").split(" ").filter(Boolean).map(function (t) {
      return { text: t.replace(/_/g, " "), kind: /^Q/.test(t) ? "q" : /^h?E/.test(t) ? "e" : "n" };
    });
  }
  function listNames(names) {
    if (names.length <= 1) return names.join("");
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }
  function possessive(n) { return n + (/s$/.test(n) ? "'" : "'s"); }

  /* profile("Bennett") -> that character's own part of any rotation */
  function profile(name) {
    var r = ROT[name];
    if (!r) return null;
    var part = function (x) { return x ? { actions: tokens(x.a), a: x.a, seconds: x.t || 0, lasts: x.up || 0, text: x.d } : null; };
    return {
      name: name, phase: phaseOf(r.p), p: r.p, actions: tokens(r.a), a: r.a, seconds: r.t, lasts: r.up || 0, text: r.d,
      onField: r.p >= 4.5, pre: part(r.pre), alt: part(r.alt)
    };
  }

  function driverScore(name) {
    var r = ROT[name], c = BY[name];
    if (r.drv) return r.drv;
    return (c.w === "Catalyst" ? 2 : 0) + (c.cat === "sub" ? 1 : 0);
  }
  function wantsAlt(name, team) {
    var r = ROT[name];
    if (!r.alt || !r.altWhen) return false;
    if (r.altWhen === "bloom") {
      var el = {};
      team.forEach(function (n) { if (n !== name) el[BY[n].e] = 1; });
      return !!(el.Dendro && el.Hydro);
    }
    return false;
  }
  function textFor(name, r, team) {
    var out = r.d;
    if (r.w) Object.keys(r.w).forEach(function (mate) { if (team.indexOf(mate) >= 0) out += " " + r.w[mate]; });
    return out;
  }

  /* rotation(["Hu Tao","Xingqiu","Yelan","Zhongli"]) -> ordered steps + advice */
  function rotation(teamIn) {
    var seen = {};
    var team = (teamIn || []).filter(function (n) {
      if (!n || !BY[n] || !ROT[n] || seen[n]) return false;
      seen[n] = 1; return true;
    });
    if (!team.length) return null;

    /* who owns the field? a carry that cannot go off-field wins; the earlier slot breaks ties */
    var carries = team.filter(function (n) { return ROT[n].p >= 4.5 && !wantsAlt(n, team); });
    var anchor = null;
    carries.forEach(function (n) {
      if (!anchor) { anchor = n; return; }
      var a = ROT[anchor], b = ROT[n];
      if (b.p > a.p || (b.p === a.p && a.alt && !b.alt)) anchor = n;
    });
    var others = carries.filter(function (n) { return n !== anchor && !ROT[n].alt; });

    var steps = [];
    team.forEach(function (n, slot) {
      var r = ROT[n], isAnchor = n === anchor;
      if (!isAnchor && r.alt && (anchor || wantsAlt(n, team))) {
        steps.push({ who: n, p: r.alt.p, a: r.alt.a, t: r.alt.t, up: r.alt.up || 0, d: r.alt.d, slot: slot, mode: "alt" });
        return;
      }
      if (r.pre) steps.push({ who: n, p: 0.9, a: r.pre.a, t: r.pre.t, up: 0, d: r.pre.d, slot: slot, mode: "pre" });
      var p = r.p, second = false;
      if (!isAnchor && anchor && p >= 4.5) { p = 4.4; second = true; }
      steps.push({ who: n, p: p, a: r.a, t: r.t, up: r.up || 0, d: textFor(n, r, team), slot: slot, mode: isAnchor ? "anchor" : second ? "second" : "main" });
    });
    steps.sort(function (x, y) { return x.p - y.p || x.slot - y.slot; });

    /* nobody carries: the best driver stays out and Normal Attacks */
    var driver = null;
    if (!anchor && team.length > 1) {
      team.forEach(function (n) { if (!driver || driverScore(n) > driverScore(driver)) driver = n; });
      var fed = team.filter(function (n) { return n !== driver && ROT[n].na; });
      steps.push({
        who: driver, p: 5, a: "N×10 E", t: 8, up: 0, slot: team.indexOf(driver), mode: "driver",
        d: "Stay on field with " + driver + " and keep Normal Attacking" +
          (fed.length ? " — that is what triggers " + listNames(fed.map(possessive)) + " off-field damage" : "") +
          ". Use the Skill again whenever it is ready, then start over from step 1."
      });
    }
    var onField = anchor || driver || team[0];

    var out = steps.map(function (s, i) {
      return {
        n: i + 1, who: s.who, element: BY[s.who].e, actions: tokens(s.a), a: s.a, seconds: s.t, lasts: s.up, text: s.d,
        phase: s.mode === "driver" ? "field" : s.mode === "second" ? "carry" : phaseOf(s.p), mode: s.mode
      };
    });
    var seconds = Math.round(out.reduce(function (a, s) { return a + s.seconds; }, 0));

    var curated = team.length === 4 ? TEAM_INDEX[teamKey(team)] : null;
    var offField = steps.filter(function (s) { return s.mode === "alt"; }).map(function (s) { return s.who; });
    var notes = (curated ? curated.notes.slice() : []).concat(autoNotes(team, onField, anchor, others, !!curated, offField));

    return {
      team: team, steps: out, seconds: seconds, onField: onField, anchor: anchor, driver: driver,
      curated: !!curated, notes: notes, partial: team.length < 4,
      short: out.map(function (s) { return s.who + " " + s.actions.map(function (t) { return t.text; }).join(" "); }).join("  >  ")
    };
  }

  function autoNotes(team, onField, anchor, others, curated, offField) {
    var out = [];
    var withFlag = function (f) { return team.filter(function (n) { return ROT[n][f]; }); };

    if (others.length) {
      out.push(listNames(others) + (others.length > 1 ? " are" : " is") + " also an on-field carry. " + anchor +
        " is treated as the main one here — give the other a short window, or swap one of them for a support.");
    }
    if (!curated) {
      if (team.indexOf("Bennett") >= 0 && team.length > 1) {
        out.push("Fight inside Bennett's circle. Step out of it and the ATK buff is gone.");
      }
      var na = withFlag("na").filter(function (n) { return n !== onField; });
      if (na.length && team.length > 1) {
        out.push(ROT[onField].noNA
          ? listNames(na.map(possessive)) + " Burst only triggers on Normal Attacks, and " + onField + " mostly uses other attacks — expect far fewer hits from it."
          : listNames(na.map(possessive)) + " Burst only triggers when the active character Normal Attacks — keep attacking with " + onField + ".");
      }
      var vv = withFlag("vv").filter(function (n) { return n !== onField; });
      if (vv.length) {
        var carry = BY[onField];
        var swirlable = { Pyro: 1, Hydro: 1, Electro: 1, Cryo: 1 };
        var els = [];
        team.forEach(function (n) { var e = BY[n].e; if (swirlable[e] && els.indexOf(e) < 0) els.push(e); });
        if (swirlable[carry.e]) {
          out.push(listNames(vv) + " should Swirl " + carry.e + " (what " + onField + " deals): it must already be on the enemy when the Swirl happens. The RES shred only applies to the element that got Swirled.");
        } else if (carry.e === "Geo" || carry.e === "Dendro") {
          out.push("Anemo cannot Swirl " + carry.e + ", so " + listNames(vv.map(possessive)) + " RES shred does nothing for " + possessive(onField) + " own damage" +
            (els.length ? " — it only helps the " + els.join(" / ") + " hits." : "."));
        } else if (els.length) {
          out.push(listNames(vv) + " can Swirl " + els.join(" or ") + " — make sure it is on the enemy first, or the Swirl does nothing.");
        }
      }
    }
    /* the hungriest Burst on the team (hand-written lineups already say it; off-field modes skip their Burst) */
    var hungry = null;
    if (!curated) team.forEach(function (n) {
      var er = erOf(n);
      if (offField.indexOf(n) >= 0) return;
      if (er && er[1] >= 200 && (!hungry || er[1] > erOf(hungry)[1])) hungry = n;
    });
    if (hungry) {
      var he = erOf(hungry);
      out.push(hungry + " needs the most Energy Recharge here (" + he[0] + "–" + he[1] + "%). If a Burst is not ready, never stand around waiting — finish the loop and it will be ready next time.");
    }
    if (team.length > 1) {
      out.push("First loop of a fight: Bursts may still be empty. Press the Skills in the same order anyway — from the second loop on, everything lines up.");
    }
    return out;
  }

  /* plain text for the copy button */
  function rotationText(rot) {
    if (!rot) return "";
    var lines = ["Rotation — " + rot.team.join(" / ") + " (about " + rot.seconds + "s per loop)"];
    rot.steps.forEach(function (s) {
      lines.push(s.n + ". " + s.who + ": " + s.actions.map(function (t) { return t.text; }).join(" > ") + " — " + s.text);
    });
    lines.push("Then start again from step 1.");
    if (rot.notes.length) {
      lines.push("");
      rot.notes.forEach(function (n) { lines.push("• " + n); });
    }
    lines.push("");
    lines.push("Short form: " + rot.short);
    lines.push("E = Skill, hE = hold Skill, Q = Burst, N = Normal Attack, CA = Charged Attack, P = plunge");
    return lines.join("\n");
  }

  return {
    STAT: STAT, ROT: ROT, STAT_META: STAT_META, STAT_LEGEND: STAT_LEGEND, STAT_EARLY: STAT_EARLY, STAT_SHORT: STAT_SHORT, ER_HINT: ER_HINT,
    PHASES: PHASES, BASICS: BASICS, LEGEND: LEGEND, STARTERS: STARTERS, TEAM_NOTES: TEAM_NOTES,
    statsFor: statsFor, checkStat: checkStat, statScore: statScore, fmtStat: fmtStat, erOf: erOf, noEnergy: noEnergy,
    profile: profile, rotation: rotation, rotationText: rotationText, tokens: tokens, phaseOf: phaseOf
  };
});

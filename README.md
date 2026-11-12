# Traveler's Guide — Irminsul Forge (Tracking Center edition)

A fan-made Genshin Impact **7.2** planning site: character builds, a team builder, and a new
**Tracking Center** — its own sector where you choose which characters to watch and monitor them.

Built as a successor to *Irminsul Forge 1.0*, keeping its roster, build data and art, and rebuilding
the character-tracking part from scratch.

---

## What the tracker does now

In 1.0 progress lived in a modal inside the team builder: you had to open a character, find *My
progress* at the bottom of their panel, type something, and only then did they appear in a small
popup table. There was no way to choose a watch list, no totals, no "what do I farm today", and the
free Traveler could not be tracked at all.

Here it is a page of its own — `tracker.html` — with four sectors:

| Sector | What it gives you |
| --- | --- |
| **Select** (left rail) | Tick anyone in the 123-character roster to track them. Search, filter by element / rarity / role / owned, or bulk-add the 7.2 marquee set. Ticking is *only* about monitoring — it never edits your team. |
| **Watchlist** (right) | One card per tracked character: level slider + talent steppers, ascension/talent progress bars, readiness ring, Mora still needed, crowns owed, and the **bottleneck** ("*Mask of the Virtuous Doctor is the gate · Weekly boss · 18 wks*"). Expand for per-material `＋/−` counters. Sort by priority / most missing / closest to ready / longest farm; filter by status; flip to a sortable table. |
| **This week at a glance** | A 7-day strip: talent-book domains are day-locked, so it shows which series your watchlist owes on each day, highlights today, and notes the Monday weekly-boss reset. |
| **Combined material list** | Every tracked character's remaining needs **merged** — one row per material, with how many characters want it, what you banked, what is missing, how many weeks that takes, and whether it is farmable today. Tabs for *Open today / Day-locked / Weekly & crowns / Banked*, plus copy-to-clipboard and print. |

Supporting behaviour: Main / Alt / Someday priority per character · farm-rate settings (weekly yields,
editable, since resin habits differ) · localStorage persistence with an explicit "storage is blocked"
warning · export / import / download `.json` · a `✓ Track this team` hand-off from the builder
(`tracker.html?t=Mitya,Valeriy,…`) · the old `irminsul:tracker` data is migrated automatically on first load.

Also fixed from 1.0: a character with no per-level talent table (Mitya, Valeriy) now gets the standard
curve, the Traveler gets a clearly-labelled **generic 5★ template** instead of an empty panel, and the
"complete" percentage no longer reports 25% for a finished build.

## For new players: rotations and stat targets

Two questions every beginner asks are answered on the pages themselves. Both live in `guide.js`.

**"Who do I press, and in what order?"** — the team builder (`builder.html`) turns any lineup into a
numbered **rotation guide**: who to swap to, which buttons (`E` Skill, `Q` Burst, `N` Normal Attack…),
how long each step takes and *why* it sits where it does (long-lasting setup first, short buffs last,
then the damage dealer). The eight 7.2 presets and three **starter lineups** (National, Hyperbloom,
Taser — all teachable with 4★ characters) carry hand-written notes; every other combination of the
123 characters is ordered by the same rules, with warnings for the classic mistakes (Bennett's circle,
Swirling the wrong element, two on-field carries, the hungriest Burst). *Copy as text* puts it on the
clipboard. Each build sheet also shows that character's own part under **In a rotation**.

**"What stats should this character have?"** — every character has **stat targets**: a minimum and a
comfortable goal for the stats that matter to them (ATK, Max HP, DEF, Elemental Mastery, CRIT Rate,
CRIT DMG) plus the Energy Recharge range, with a one-line note on what they actually scale on. They
appear on the build sheet (`index.html`), side by side for the whole team in the builder, and as a
fold-out on each Tracking Center card. Type the numbers from the in-game character screen into
**Yours** and each stat tells you whether it is short, at the minimum, or at the goal; those numbers
are saved (and exported) with the watchlist.

The targets are guidelines for a Lv.90 character with a Lv.90 weapon and +20 artifacts, read from the
character screen outside combat. To change one, edit the `STAT` / `ROT` tables at the top of `guide.js`
— the header comment explains every field, and `npm test` tells you if something is missing.

## Layout

```
index.html        roster + build sheets (weapons, artifact, stat targets, partners, rotation, materials) + Track toggles
tracker.html      the Tracking Center described above
builder.html      4-slot team builder, presets + starter lineups, rotation guide, team stat targets,
                  engine/role analysis, hand-off to the tracker
app.css           design system (dark ink-blue + gold, as 1.0)
data.js           7.2 roster, materials, builds, banners, presets, domain schedule
img.js            base64 icon atlas: 123 portraits, 309 material icons, weapons, sets
forge-core.js     all tracker maths — no DOM, shared by the pages and the tests
guide.js          stat targets + rotation logic for all 123 characters — no DOM, loaded after forge-core.js
app.js            shared UI helpers + watchlist store
page-*.js         per-page rendering and events
test/             36 assertions over the data, the logic and the rendered pages
```

## Run it

Any static host. Locally: `python3 -m http.server 8080` in this folder, then open `index.html`.
(Opening the files directly with `file://` also works; only localStorage-backed features differ.)

For **GitHub Pages**: push this folder to a repo, then *Settings → Pages → Deploy from a branch →
`main` / `(root)`*. The site works with no build step and no network dependencies — all art and data
are inlined, so it renders inside sandboxes and offline.

## Tests

```
npm install   # jsdom, only needed for the page tests
npm test      # node --test test/
```

`test/core.test.mjs` exercises the planner itself (material curves, ascension stages, crown counts,
weekly-boss gating, day rotation, consolidation, aggregates). `test/pages.test.mjs`, `test/site.test.mjs`
and `test/render.test.mjs` load the real pages in jsdom and click through them — tracking a character,
typing a level, banking materials, switching tabs, reloading from storage — and assert the DOM agrees
with the engine.

`test/guide.test.mjs` covers the guide: every character has stat targets and a rotation entry, the
numbers are sane, every preset and starter lineup (plus 600 generated teams) produces a complete,
correctly ordered rotation, and — when jsdom is installed — the build sheet, the builder and the
tracker actually render and react to typed-in stats. Its data checks run with plain `node`, no install.

## Notes on the data

Roster, builds and art follow the "Version 7.2 — Hour of Ruin" snapshot from Irminsul Forge 1.0 (123
characters, including beta characters). Talent-book domain days are derived: 24 book series are spread
over three day-pairs (Mon/Thu, Tue/Fri, Wed/Sat) with Sunday open to all, and weekly-boss loot resets
Monday — if your server's schedule differs, edit `bookDays` / `weeklyResetDay` in `data.js`.
Weekly yields behind the time estimates are defaults you can retune in *Farm rates*.

Fan-made tool, not affiliated with HoYoverse.

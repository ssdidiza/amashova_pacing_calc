# Agent guide — Race Pace Calculator

Static, zero-build web app that generates cycling race pacing plans and
race-ready print formats. Started as the Amashova Split Calculator, now a
multi-race platform. **Read ROADMAP.md before starting work** — it tracks
what is done, what is next, and open questions.

## Architecture

No framework, no bundler, no npm install. Plain HTML/CSS/JS served as-is;
the only runtime dependency is Chart.js from a CDN. Open `index.html` or run
any static server.

| Path | Role |
| --- | --- |
| `index.html` | Single page: inputs, results, print-preview dialog, script includes |
| `script.js` | App logic: race registry, split calculations, share links, settings |
| `style.css` | Screen styles (dark/light themes via CSS vars on `body[data-theme]`) |
| `print.js` | PrintKit: stem card / top tube strip / full plan templates, fuel engine, preview + print flow |
| `print.css` | Print template styles (mm units) + `@media print` rules |
| `races/*.js` | One file per race; registers a config on `window.RACES` |
| `tools/gpx-to-config.js` | Node script: GPX + manifest → generated race config |
| `tools/manifests/*.json` | Per-race generation inputs (metadata, official checkpoint km) |
| `routes/*.gpx` | Source GPX files |
| `samples/` | Generated sample PDFs/screenshots (committed as review artifacts) |

### Key invariants

- **Everything reads from the active race config only.** The calculator and
  all print templates take data from `raceConfig` / the `getPlanData()`
  snapshot — never hardcode a race name, distance, or checkpoint anywhere
  else. Adding a race must never require touching templates.
- **Script order matters:** `races/*.js` → `print.js` → `script.js`
  (all `defer`; later scripts consume `window.RACES` / `window.PrintKit`).
- **Generated race files are not hand-edited.** Change the manifest in
  `tools/manifests/` and rerun
  `node tools/gpx-to-config.js tools/manifests/<race>.json`.
  (`races/amashova-106.js` is the exception: hand-tuned legacy factors.)
- **Style.css ordering trap:** base rules appended late in the file override
  earlier `@media` blocks — responsive overrides for new components belong in
  the media-query blocks at the *end* of the file.
- Checkpoint positions use **official race km**; the generator maps them onto
  GPX distance proportionally (GPX rarely matches the official distance).
- Print pages are A4 portrait only; cards render true-size with cut lines,
  the 220 mm top-tube strip is rotated 90° (`.tube-rotor`). Stem cards
  auto-switch to `is-dense` above 7 checkpoints.
- `?print=stem|tube|full|all` stages a format at page load (captured at
  script parse time — the app rewrites the URL afterwards). Used for deep
  links and headless PDF export.
- Ctrl+P always prints the full plan, never the app UI.

## Commands

```bash
# serve locally (any static server works)
npx -y http-server . -p 8123 -c-1

# regenerate a race config from GPX
node tools/gpx-to-config.js tools/manifests/ridejoburg-97-2026.json

# sample PDF (headless Chrome/Edge)
chrome --headless=new --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf=out.pdf "http://localhost:8123/?race=<id>&print=all"
```

## Verification expectations

Before committing UI or print changes: load both races in a browser, check
the console for errors, switch races both directions, open the print preview
for all four formats, and regenerate + visually inspect the affected sample
PDFs in `samples/`. Test mobile width (~390 px) — the dialog and grids have
mobile-specific rules.

## Conventions

- Vanilla JS, `'use strict'`, 4-space indent, single quotes.
- Copy tone: plain, rider-focused, South African race context.
- **Messaging rule:** Ride Joburg 2026 is an *"all-new route with a new
  start/finish at Kyalami"* — never describe it as "reversed" or "flipped".
- Pacing/fuel guidance is indicative; keep disclaimers on all outputs.
- Commit messages describe rider-facing impact; end with the Claude
  co-author line when AI-authored.

## Housekeeping

- **Update ROADMAP.md at the end of every working session** (move items
  between Done/Next, note new caveats). It is the handoff document.
- Keep `README.md` user-facing; keep this file agent-facing.

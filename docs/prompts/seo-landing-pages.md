# Session prompt — per-race SEO landing pages

Copy-paste the block below into a fresh session, run from a clone of the
repo.

---

Build per-race SEO landing pages for the Race Pace Calculator.

Repo: https://github.com/ssdidiza/amashova_pacing_calc — work in the local
clone. **First read `AGENTS.md` and `ROADMAP.md`** for architecture,
invariants, and current status. The app is a zero-build static site; races
are registered in `races/*.js` and the app preselects a race via `?race=`.

Goal: when someone searches "ride joburg 2026 pacing chart", "ride joburg
route splits" or "amashova pacing calculator", they should land on a fast
page that answers immediately and funnels them into the calculator.

Tasks:

1. Write a generator script `tools/build-landing-pages.js` (Node, no deps)
   that reads each race config in `races/` and emits a static landing page
   per race (`amashova/index.html`, `ridejoburg/index.html` — pick slugs
   from a small map in the script). Generated pages are committed. Do not
   hand-write the pages; new races must get a page by rerunning the script.
2. Each page must contain real crawlable HTML (no JS required to read it):
   - title + meta description targeting the race name and year
   - h1, race summary (distance, climbing, start/finish location), the
     checkpoint/water-point table with distances, and the named climbs
   - a prominent "Build your pacing plan" CTA linking to
     `../index.html?race=<id>` (relative links — hosting root unconfirmed)
   - a short section on the print formats (stem card, top tube strip, full
     plan) with the fuel-strategy pitch
   - JSON-LD (`SportsEvent` for the race + `WebApplication` for the tool),
     OpenGraph/Twitter meta tags
   - lightweight inline CSS consistent with the app's look (dark theme,
     Inter, accent #39d7bd); no Chart.js, no app JS
3. Add `sitemap.xml` and `robots.txt`. Canonical URLs: check the repo/gh
   settings for GitHub Pages or a custom domain; if the live URL cannot be
   determined, use relative canonicals, leave a TODO in ROADMAP.md, and say
   so in your report.
4. Messaging rule (important): Ride Joburg 2026 is an "all-new route with a
   new start and finish at Kyalami — old splits don't apply". Never call it
   "reversed" or "flipped".
5. Verify: serve locally, check both landing pages render (desktop + ~390 px
   mobile), view-source contains the full content, all links into the
   calculator preselect the right race, and the app itself still works.
6. Update ROADMAP.md (move item 1 to Done with date + commit), then commit
   with a descriptive message. Do not push unless asked.

Do not modify the calculator app itself except, if needed, a `<link
rel="canonical">`/OG tags in `index.html`.

---

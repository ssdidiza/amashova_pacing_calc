# Race Pace Calculator

## Description

A web-based tool that helps cyclists plan their race strategy. It started as the Amashova Split Calculator and now supports multiple races through a race picker:

*   **Amashova Durban Classic** — 106 km, Pietermaritzburg → Durban
*   **Ride Joburg 97 (2026)** — 97 km, the all-new Kyalami route

The Amashova Split Calculator is a web-based tool designed to help cyclists plan their race strategy for the Amashova Durban Classic or similar cycling events. Users can input their target finish time, start time, and preferred pacing strategy, and the calculator will generate detailed split times for various segments of the race. It also visualizes the pacing strategy on a bar chart and allows exporting the split data to a CSV file.

## How to Run

1.  Clone or download the repository.
2.  Open the `index.html` file in a modern web browser (e.g., Chrome, Firefox, Safari, Edge).

There are no build steps or dependencies required beyond a standard web browser with JavaScript enabled.

## Features

*   **Target Time Input:** Set your desired overall finish time in hours and minutes.
*   **Start Time Input:** Specify your race start time to get estimated arrival times at each checkpoint.
*   **Pacing Strategies:** Choose from different pacing strategies (e.g., even, conservative, aggressive) to see how they affect split times.
*   **Detailed Split Table:** View a breakdown of:
    *   Segment name
    *   Distance of the segment
    *   Total distance covered
    *   Estimated time to reach the end of the segment
    *   Estimated time of day at arrival
    *   Time taken for the current split
    *   Average speed for the current split
    *   Moving average speed for the entire race up to that point
*   **Pacing Chart:** A bar chart visualizes the calculated speed for each segment, making it easy to see the intensity distribution.
*   **Race-Ready Print Formats:** The Print / Save PDF button opens a preview where you choose between:
    *   **Stem card (90 × 60 mm):** big-type checkpoint ETAs, fuel line and top notes — tape it to your stem. Prints with a spare copy.
    *   **Top tube strip (220 × 40 mm):** horizontal distance/ETA timeline with climb markers (▲) and gel/salt dots — tape it along the top tube.
    *   **Full race plan (A4):** rider inputs, checkpoint pacing, elevation profile, fuel & hydration schedule, segment notes and rider notes.
    *   **All formats:** cards sheet plus the full plan in one print job.
    Cards print at true physical size on A4 with dashed cut lines. `?print=stem|tube|full|all` in the URL deep-links straight to a staged print (handy for headless PDF generation).
*   **Fuel Strategy:** pick a carb target (40/60/90 g/h) and drink reminder interval; the app generates a gel schedule (with time, clock and distance), hydration guidance and optional hourly sodium reminders.
*   **Custom Race Notes:** personal reminders ("Don't chase early attacks") that appear on every print format and travel with share links.
*   **CSV Export:** Export the calculated split data to a CSV file for offline use or sharing.
*   **Theme Toggle:** Switch between light and dark themes for user preference.
*   **Responsive Design:** The interface is designed to be usable on different screen sizes.

## Technologies Used

*   **HTML:** For the basic structure of the web page.
*   **CSS:** For styling the user interface, including a dark/light theme.
*   **JavaScript (Vanilla JS):** For all the logic, including:
    *   Calculating splits based on various inputs.
    *   DOM manipulation to display results.
    *   Event handling for user interactions.
    *   Chart rendering using the Chart.js library.
    *   CSV file generation.

## Segments Data

The calculator uses predefined segments based on the Amashova race route, with specific distances for each. Pacing factors are applied to these segments to model different race strategies.

## Race Configuration

Each race lives in its own file under `races/`, registered on `window.RACES`. The calculation engine and every print template read only from the active config (name, distance, checkpoints, climbs, elevation profile, pacing-factor strategies), so adding a race never touches the templates.

### Adding a race from a GPX file

1. Drop the GPX in `routes/`.
2. Create a manifest in `tools/manifests/<race>.json` with the race metadata and official checkpoint distances (see `ridejoburg-97-2026.json` for the format).
3. Run `node tools/gpx-to-config.js tools/manifests/<race>.json`.

The generator computes distances, fetches and smooths elevation (open-elevation.com, with a local cache), derives per-segment pacing factors from gradient, builds conservative/aggressive variants, and writes the race file into `races/`. Add a `<script>` tag for it in `index.html` and it appears in the race picker.

Share links carry the race (`?race=<id>`), and `?print=stem|tube|full|all` deep-links to a staged print for any race.

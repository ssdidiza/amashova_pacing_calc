#!/usr/bin/env node
'use strict';

// Builds static SEO landing pages from the race configs in races/.
//
//   node tools/build-landing-pages.js
//
// Emits <slug>/index.html per race plus sitemap.xml and robots.txt at the
// repo root. Pages are committed; rerun after adding or regenerating a race.
// No dependencies — plain Node (fs, path, vm).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const RACES_DIR = path.join(ROOT, 'races');

// Live site (GitHub Pages, main branch root — no custom domain as of 2026-07).
// If the site moves to a custom domain, update this constant and rerun.
const SITE_URL = 'https://ssdidiza.github.io/amashova_pacing_calc';

// Race id → URL slug. Add new races here (falls back to the id with a warning).
const SLUGS = {
    'amashova-106': 'amashova',
    'ridejoburg-97-2026': 'ridejoburg'
};

// Race id → OG image (committed screenshots in samples/).
const OG_IMAGES = {
    'amashova-106': 'samples/app-desktop.png',
    'ridejoburg-97-2026': 'samples/app-ridejoburg.png'
};

const MONTHS = {
    january: '01', february: '02', march: '03', april: '04', may: '05',
    june: '06', july: '07', august: '08', september: '09', october: '10',
    november: '11', december: '12'
};

function loadRaces() {
    const sandbox = { window: { RACES: {} } };
    vm.createContext(sandbox);
    const files = fs.readdirSync(RACES_DIR).filter(function (f) { return f.endsWith('.js'); }).sort();
    files.forEach(function (file) {
        vm.runInContext(fs.readFileSync(path.join(RACES_DIR, file), 'utf8'), sandbox, { filename: file });
    });
    return Object.values(sandbox.window.RACES);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatKm(km) {
    return (Math.round(km * 10) / 10).toString().replace(/\.0$/, '');
}

function raceYear(race) {
    const match = /(\d{4})/.exec(race.edition || '');
    return match ? match[1] : '';
}

function raceStartDate(race) {
    const year = raceYear(race);
    const monthWord = (race.edition || '').toLowerCase().match(/[a-z]+/);
    const month = monthWord ? MONTHS[monthWord[0]] : null;
    if (year && month) return year + '-' + month;
    return year || null;
}

function routePhrase(race) {
    if (race.startLocation === race.finishLocation) {
        return 'starting and finishing at ' + race.startLocation;
    }
    return 'from ' + race.startLocation + ' to ' + race.finishLocation;
}

function buildJsonLd(race, canonical) {
    const year = raceYear(race);
    const event = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: race.name + (year ? ' ' + year : ''),
        sport: 'Cycling',
        description: 'Road cycling race over ' + formatKm(race.distanceKm) + ' km, ' + routePhrase(race) + '.',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: race.startLocation,
            address: { '@type': 'PostalAddress', addressCountry: 'ZA' }
        }
    };
    const startDate = raceStartDate(race);
    if (startDate) event.startDate = startDate;

    const app = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Race Pace Calculator',
        url: SITE_URL + '/index.html?race=' + race.id,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Any',
        description: 'Free pacing calculator: checkpoint arrival times, fuel strategy and printable race cards for South African road cycling races.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'ZAR' },
        about: { '@type': 'SportsEvent', name: event.name }
    };
    return [event, app];
}

const PAGE_CSS = [
    ':root{--bg:#08111f;--surface:#101b2d;--surface-strong:#15243a;--text:#f7fafc;--text-muted:#9fb0c7;--accent:#39d7bd;--accent-strong:#1cb69d;--border:rgba(255,255,255,0.11);}',
    '*{box-sizing:border-box;}',
    'body{margin:0;min-width:320px;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text);background:radial-gradient(circle at 15% 0%,rgba(57,215,189,0.15),transparent 30rem),var(--bg);line-height:1.55;}',
    'a{color:var(--accent);}',
    'main{width:min(880px,calc(100% - 32px));margin:0 auto;padding:48px 0 40px;}',
    '.eyebrow{color:var(--accent);font-size:0.76rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;}',
    'h1{font-size:clamp(1.7rem,4.5vw,2.5rem);line-height:1.15;margin:10px 0 12px;}',
    'h2{font-size:1.25rem;margin:0 0 12px;}',
    '.lead{color:var(--text-muted);font-size:1.05rem;max-width:60ch;margin:0 0 18px;}',
    '.notice{border:1px solid rgba(57,215,189,0.4);background:rgba(57,215,189,0.08);border-radius:14px;padding:12px 16px;margin:0 0 22px;font-weight:600;}',
    '.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 28px;padding:0;list-style:none;}',
    '.stats li{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;}',
    '.stats .label{display:block;color:var(--text-muted);font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;}',
    '.stats .value{font-size:1.15rem;font-weight:700;}',
    '.cta{display:inline-block;background:var(--accent);color:#04211c;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:1.05rem;box-shadow:0 14px 40px rgba(57,215,189,0.25);}',
    '.cta:hover{background:var(--accent-strong);}',
    '.cta-note{color:var(--text-muted);font-size:0.9rem;margin:10px 0 0;}',
    'section{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px 24px;margin:26px 0;}',
    '.table-wrap{overflow-x:auto;}',
    'table{border-collapse:collapse;width:100%;font-size:0.95rem;}',
    'th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top;}',
    'th{color:var(--text-muted);font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;}',
    'td.num,th.num{text-align:right;white-space:nowrap;}',
    'td .cp-note{display:block;color:var(--text-muted);font-size:0.85rem;margin-top:2px;}',
    '.climbs{list-style:none;margin:0;padding:0;display:grid;gap:8px;}',
    '.climbs li{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--border);padding-bottom:8px;}',
    '.climbs .km{color:var(--text-muted);white-space:nowrap;}',
    '.formats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:14px 0 0;padding:0;list-style:none;}',
    '.formats li{background:var(--surface-strong);border:1px solid var(--border);border-radius:14px;padding:14px 16px;}',
    '.formats strong{display:block;margin-bottom:4px;}',
    '.formats p{margin:0;color:var(--text-muted);font-size:0.9rem;}',
    '.cta-band{text-align:center;background:linear-gradient(160deg,rgba(57,215,189,0.14),rgba(57,215,189,0.03));}',
    'footer{color:var(--text-muted);font-size:0.85rem;padding:8px 4px 28px;}',
    'footer p{margin:6px 0;}',
    '@media (max-width:480px){main{padding-top:32px;}section{padding:18px 16px;}th,td{padding:8px 8px;}}'
].join('');

function buildPage(race, slug, otherRaces) {
    const year = raceYear(race);
    const dist = formatKm(race.distanceKm);
    const canonical = SITE_URL + '/' + slug + '/';
    const appLink = '../index.html?race=' + race.id;
    const title = race.name + (year ? ' ' + year : '') + ' Pacing Chart & Splits Calculator';
    const description = 'Free ' + race.name + (year ? ' ' + year : '') + ' pacing calculator: checkpoint arrival times for the ' +
        dist + ' km route ' + routePhrase(race) + ', water point splits, a fuel plan and printable race cards.';
    const ogImage = OG_IMAGES[race.id] ? SITE_URL + '/' + OG_IMAGES[race.id] : null;
    const jsonLd = buildJsonLd(race, canonical);

    const checkpointRows = race.checkpoints.map(function (cp) {
        return [
            '                    <tr>',
            '                        <td><strong>' + escapeHtml(cp.name) + '</strong>' +
                (cp.note ? '<span class="cp-note">' + escapeHtml(cp.note) + '</span>' : '') + '</td>',
            '                        <td class="num">' + formatKm(cp.dist) + ' km</td>',
            '                        <td class="num">' + formatKm(cp.totalDist) + ' km</td>',
            '                    </tr>'
        ].join('\n');
    }).join('\n');

    const climbItems = (race.climbs || []).map(function (climb) {
        return '                <li><span>' + escapeHtml(climb.name) + '</span><span class="km">± km ' + formatKm(climb.km) + '</span></li>';
    }).join('\n');

    const statItems = [
        { label: 'Distance', value: dist + ' km' },
        race.climbGain ? { label: 'Climbing', value: '±' + race.climbGain + ' m' } : null,
        { label: 'Start', value: race.startLocation },
        { label: 'Finish', value: race.finishLocation },
        { label: 'Water points', value: String(race.checkpoints.length - 1) },
        race.edition ? { label: 'Edition', value: race.edition } : null
    ].filter(Boolean).map(function (stat) {
        return '            <li><span class="label">' + escapeHtml(stat.label) + '</span><span class="value">' + escapeHtml(stat.value) + '</span></li>';
    }).join('\n');

    const crossLinks = otherRaces.map(function (other) {
        return '<a href="../' + other.slug + '/">' + escapeHtml(other.race.name + (raceYear(other.race) ? ' ' + raceYear(other.race) : '')) + ' pacing chart</a>';
    }).join(' · ');

    return ['<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        '    <title>' + escapeHtml(title) + '</title>',
        '    <meta name="description" content="' + escapeHtml(description) + '">',
        '    <meta name="theme-color" content="#0b1220">',
        '    <link rel="canonical" href="' + canonical + '">',
        '    <meta property="og:type" content="website">',
        '    <meta property="og:site_name" content="Race Pace Calculator">',
        '    <meta property="og:title" content="' + escapeHtml(title) + '">',
        '    <meta property="og:description" content="' + escapeHtml(description) + '">',
        '    <meta property="og:url" content="' + canonical + '">',
        ogImage ? '    <meta property="og:image" content="' + ogImage + '">' : null,
        '    <meta name="twitter:card" content="' + (ogImage ? 'summary_large_image' : 'summary') + '">',
        '    <meta name="twitter:title" content="' + escapeHtml(title) + '">',
        '    <meta name="twitter:description" content="' + escapeHtml(description) + '">',
        ogImage ? '    <meta name="twitter:image" content="' + ogImage + '">' : null,
        '    <link rel="preconnect" href="https://fonts.googleapis.com">',
        '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">',
        '    <style>' + PAGE_CSS + '</style>',
        '    <script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>',
        '</head>',
        '<body>',
        '    <main>',
        '        <header>',
        '            <p class="eyebrow">Free race pacing tool · South Africa</p>',
        '            <h1>' + escapeHtml(race.name) + (year ? ' ' + year : '') + ' pacing chart &amp; splits</h1>',
        '            <p class="lead">' + escapeHtml(race.heroCopy) + '</p>',
        race.notice ? '            <p class="notice">' + escapeHtml(race.notice) + '</p>' : null,
        '            <a class="cta" href="' + appLink + '">Build your pacing plan &rarr;</a>',
        '            <p class="cta-note">Free, no sign-up. Set a target time and get checkpoint ETAs, speeds and a fuel schedule.</p>',
        '        </header>',
        '',
        '        <ul class="stats">',
        statItems,
        '        </ul>',
        '',
        '        <section aria-labelledby="checkpoints-title">',
        '            <h2 id="checkpoints-title">Checkpoints &amp; water points</h2>',
        '            <p>Official route distances. The calculator turns these into arrival times for your target finish, with even, conservative or aggressive pacing.</p>',
        '            <div class="table-wrap">',
        '                <table>',
        '                    <thead>',
        '                        <tr><th>Checkpoint</th><th class="num">Leg</th><th class="num">Total</th></tr>',
        '                    </thead>',
        '                    <tbody>',
        checkpointRows,
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </section>',
        '',
        (race.climbs && race.climbs.length) ? [
            '        <section aria-labelledby="climbs-title">',
            '            <h2 id="climbs-title">Named climbs on the route</h2>',
            '            <ul class="climbs">',
            climbItems,
            '            </ul>',
            (race.elevationNote ? '            <p class="cta-note">' + escapeHtml(race.elevationNote) + '</p>' : ''),
            '        </section>'].join('\n') : null,
        '',
        '        <section aria-labelledby="prints-title">',
        '            <h2 id="prints-title">Race-ready printouts &amp; fuel strategy</h2>',
        '            <p>Every plan exports to three print formats sized for the bike, plus a fuel schedule: set a carb target (30&ndash;90 g/h) and gels are mapped to ride time, race clock and route km, with drink reminders and optional hourly sodium.</p>',
        '            <ul class="formats">',
        '                <li><strong>Stem card</strong><p>90 &times; 60 mm card with your splits &mdash; tape it to the stem. Spare copy included.</p></li>',
        '                <li><strong>Top tube strip</strong><p>220 &times; 40 mm strip with checkpoint ETAs and fuel cues at a glance.</p></li>',
        '                <li><strong>Full race plan</strong><p>Two A4 pages: pacing table, elevation profile, fuel &amp; hydration schedule, segment cues and notes.</p></li>',
        '            </ul>',
        '        </section>',
        '',
        '        <section class="cta-band">',
        '            <h2>Plan your ' + escapeHtml(race.name) + (year ? ' ' + year : '') + '</h2>',
        '            <p>Pick a target finish time and get checkpoint arrival times, segment speeds and a printable fuel plan in under a minute.</p>',
        '            <a class="cta" href="' + appLink + '">Build your pacing plan &rarr;</a>',
        '        </section>',
        '',
        '        <footer>',
        crossLinks ? '            <p>More races: ' + crossLinks + '</p>' : null,
        '            <p>All pacing and fuel guidance is an estimate, not a guarantee &mdash; confirm details against official race information before race day.</p>',
        '            <p>Part of the free <a href="' + appLink + '">Race Pace Calculator</a> by <a href="https://www.strava.com/athletes/26187606" rel="noopener noreferrer">Spera Didiza</a>.</p>',
        '        </footer>',
        '    </main>',
        '</body>',
        '</html>',
        ''
    ].filter(function (line) { return line !== null; }).join('\n');
}

function buildSitemap(entries) {
    const today = new Date().toISOString().slice(0, 10);
    const urls = entries.map(function (entry) {
        return [
            '    <url>',
            '        <loc>' + entry.loc + '</loc>',
            '        <lastmod>' + today + '</lastmod>',
            '        <priority>' + entry.priority + '</priority>',
            '    </url>'
        ].join('\n');
    }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
}

function main() {
    const races = loadRaces();
    if (!races.length) {
        console.error('No races found in ' + RACES_DIR);
        process.exit(1);
    }

    const entries = races.map(function (race) {
        let slug = SLUGS[race.id];
        if (!slug) {
            slug = race.id;
            console.warn('WARN: no slug mapped for race "' + race.id + '" — using the id. Add it to SLUGS in tools/build-landing-pages.js.');
        }
        return { race: race, slug: slug };
    });

    entries.forEach(function (entry) {
        const others = entries.filter(function (e) { return e !== entry; });
        const dir = path.join(ROOT, entry.slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), buildPage(entry.race, entry.slug, others));
        console.log('Wrote ' + entry.slug + '/index.html (' + entry.race.name + ')');
    });

    const sitemapEntries = [{ loc: SITE_URL + '/', priority: '1.0' }].concat(
        entries.map(function (entry) { return { loc: SITE_URL + '/' + entry.slug + '/', priority: '0.8' }; })
    );
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(sitemapEntries));
    console.log('Wrote sitemap.xml (' + sitemapEntries.length + ' URLs)');

    fs.writeFileSync(path.join(ROOT, 'robots.txt'),
        'User-agent: *\nAllow: /\n\nSitemap: ' + SITE_URL + '/sitemap.xml\n');
    console.log('Wrote robots.txt');
}

main();

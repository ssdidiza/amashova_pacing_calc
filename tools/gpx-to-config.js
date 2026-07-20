#!/usr/bin/env node
'use strict';

/*
 * gpx-to-config.js — build a raceConfig module from a GPX route.
 *
 * Usage:
 *   node tools/gpx-to-config.js tools/manifests/<race>.json
 *
 * The manifest supplies race metadata and official checkpoint distances;
 * this script derives everything measurable from the GPX:
 *   - cumulative distance (haversine)
 *   - elevation (from a cache file, or fetched from open-elevation.com)
 *   - a smoothed, decimated elevation profile
 *   - total smoothed climbing
 *   - per-segment pacing factors from distance-weighted gradients
 *   - conservative / aggressive strategy variants
 *
 * GPX distances rarely match the official race distance exactly, so all
 * checkpoint positions in the manifest are official km; they are mapped
 * onto the GPX proportionally.
 *
 * Output is a browser script that registers the race on window.RACES.
 */

const fs = require('fs');
const path = require('path');

const manifestPath = process.argv[2];
if (!manifestPath) {
    console.error('Usage: node tools/gpx-to-config.js <manifest.json>');
    process.exit(1);
}

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

/* ---------------------------------------------------------------- parse */

const gpxText = fs.readFileSync(path.resolve(root, manifest.gpx), 'utf8');
const pointRegex = /<(?:rtept|trkpt)\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"\s*\/?>(?:[\s\S]*?<ele>([-\d.]+)<\/ele>)?/g;
const rawPoints = [...gpxText.matchAll(/<(?:rtept|trkpt)\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"/g)]
    .map((m) => ({ lat: Number(m[1]), lon: Number(m[2]) }));
if (rawPoints.length < 2) {
    console.error('No route/track points found in GPX.');
    process.exit(1);
}

const EARTH_KM = 6371;
function haversine(a, b) {
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

let cumulative = 0;
const points = rawPoints.map((p, i) => {
    if (i > 0) cumulative += haversine(rawPoints[i - 1], p);
    return { ...p, km: cumulative };
});
const gpxDistance = cumulative;

/* ------------------------------------------------------------ elevation */

async function loadElevations() {
    if (manifest.elevationCache) {
        const cache = JSON.parse(fs.readFileSync(path.resolve(root, manifest.elevationCache), 'utf8'));
        if (cache.length === points.length) return cache.map((c) => c.ele);
        console.warn(`Elevation cache length ${cache.length} != ${points.length} points; refetching.`);
    }
    const eles = [];
    for (let i = 0; i < points.length; i += 100) {
        const batch = points.slice(i, i + 100);
        const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locations: batch.map((p) => ({ latitude: p.lat, longitude: p.lon })) })
        });
        if (!res.ok) throw new Error(`open-elevation HTTP ${res.status}`);
        const json = await res.json();
        json.results.forEach((r) => eles.push(r.elevation));
        process.stderr.write('.');
        await new Promise((r) => setTimeout(r, 700));
    }
    process.stderr.write('\n');
    return eles;
}

/* ----------------------------------------------------------------- main */

(async () => {
    const elevations = await loadElevations();
    // ~9-point moving average knocks the SRTM noise out of gain and grades.
    const smooth = elevations.map((_, i) => {
        let sum = 0;
        let n = 0;
        for (let j = Math.max(0, i - 4); j <= Math.min(elevations.length - 1, i + 4); j += 1) {
            sum += elevations[j];
            n += 1;
        }
        return sum / n;
    });

    let gain = 0;
    for (let i = 1; i < smooth.length; i += 1) {
        const d = smooth[i] - smooth[i - 1];
        if (d > 0) gain += d;
    }

    const officialKm = manifest.officialDistanceKm || gpxDistance;
    const scale = officialKm / gpxDistance; // official km = gpx km * scale

    function eleAtOfficialKm(km) {
        const target = km / scale;
        for (let i = 1; i < points.length; i += 1) {
            if (points[i].km >= target) {
                const a = points[i - 1];
                const b = points[i];
                const f = (target - a.km) / ((b.km - a.km) || 1);
                return smooth[i - 1] + f * (smooth[i] - smooth[i - 1]);
            }
        }
        return smooth[smooth.length - 1];
    }

    // Decimated profile for the print templates (~every 4 km).
    const profile = [];
    const step = officialKm / Math.ceil(officialKm / 4);
    for (let km = 0; km <= officialKm + 0.001; km += step) {
        const clamped = Math.min(km, officialKm);
        profile.push({ km: Number(clamped.toFixed(1)), ele: Math.round(eleAtOfficialKm(clamped)) });
    }

    // Distance-weighted time factor per checkpoint segment. Gradient slows a
    // rider far more than descent helps: +8.5 x grade uphill, +3.5 x grade
    // (negative) downhill, on top of a flat baseline of 1. Absolute scale is
    // irrelevant — the calculator normalises factors across the race.
    function segmentFactor(fromOfficialKm, toOfficialKm) {
        const from = fromOfficialKm / scale;
        const to = toOfficialKm / scale;
        let weighted = 0;
        let total = 0;
        for (let i = 1; i < points.length; i += 1) {
            const a = Math.max(points[i - 1].km, from);
            const b = Math.min(points[i].km, to);
            if (b <= a) continue;
            const dist = points[i].km - points[i - 1].km;
            if (dist <= 0) continue;
            const grade = (smooth[i] - smooth[i - 1]) / (dist * 1000);
            const factor = Math.min(1.8, Math.max(0.7, 1 + (grade > 0 ? 8.5 * grade : 3.5 * grade)));
            weighted += factor * (b - a);
            total += (b - a);
        }
        return total ? weighted / total : 1;
    }

    const checkpoints = manifest.checkpoints.map((cp, i) => {
        const prevKm = i === 0 ? 0 : manifest.checkpoints[i - 1].km;
        return {
            name: cp.name,
            shortName: cp.shortName || cp.name,
            dist: Number((cp.km - prevKm).toFixed(2)),
            totalDist: cp.km,
            note: cp.note || ''
        };
    });

    const even = manifest.checkpoints.map((cp, i) => {
        const prevKm = i === 0 ? 0 : manifest.checkpoints[i - 1].km;
        return Number(segmentFactor(prevKm, cp.km).toFixed(4));
    });
    // Linear effort ramps across the race: conservative banks energy early,
    // aggressive spends it early.
    const ramp = (start, end) => even.map((f, i) => {
        const t = even.length === 1 ? 0 : i / (even.length - 1);
        return Number((f * (start + (end - start) * t)).toFixed(4));
    });

    const config = {
        id: manifest.id,
        name: manifest.name,
        shortName: manifest.shortName,
        edition: manifest.edition,
        distanceKm: officialKm,
        startLocation: manifest.startLocation,
        finishLocation: manifest.finishLocation,
        heroCopy: manifest.heroCopy || '',
        notice: manifest.notice || '',
        climbGain: Math.round(gain),
        checkpoints,
        climbs: manifest.climbs || [],
        elevation: profile,
        elevationNote: manifest.elevationNote
            || 'Profile derived from route GPS data — confirm against official race information.',
        strategies: {
            even,
            conservative: ramp(1.08, 0.95),
            aggressive: ramp(0.96, 1.05)
        }
    };

    const output = path.resolve(root, manifest.output);
    const banner = `// Generated by tools/gpx-to-config.js from ${manifest.gpx}\n`
        + `// GPX distance ${gpxDistance.toFixed(2)} km (official ${officialKm} km) · `
        + `smoothed climbing ~${Math.round(gain)} m\n`
        + '// Regenerate with: node tools/gpx-to-config.js '
        + `${path.relative(root, path.resolve(manifestPath)).replaceAll('\\', '/')}\n`;
    fs.writeFileSync(
        output,
        `${banner}'use strict';\n\nwindow.RACES = window.RACES || {};\nwindow.RACES['${manifest.id}'] = `
        + `${JSON.stringify(config, null, 4)};\n`
    );
    console.log(`Wrote ${path.relative(root, output)}`);
    console.log(`  distance: gpx ${gpxDistance.toFixed(2)} km -> official ${officialKm} km`);
    console.log(`  smoothed gain: ${Math.round(gain)} m`);
    console.log(`  even factors: ${even.join(', ')}`);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});

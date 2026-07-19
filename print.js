'use strict';

/*
 * PrintKit — race-ready print formats.
 *
 * Renders three templates from the plan snapshot exposed by script.js
 * (window.getPlanData): a 90×60 mm stem card, a 220×40 mm top tube strip
 * and a two-page A4 race plan. Cards are laid out at true physical size on
 * A4 sheets with dashed cut lines; the tube strip is rotated 90° so every
 * job stays A4 portrait. Templates read only the plan object, never the
 * app DOM, so they work for any race config.
 *
 * Deep link: ?print=stem|tube|full|all stages a format at load, which also
 * powers headless PDF export.
 */
(function () {
    const GEL_CARBS_G = 25;
    const FORMATS = ['stem', 'tube', 'full', 'all'];
    const FORMAT_LABELS = { stem: 'StemCard', tube: 'TopTube', full: 'RacePlan', all: 'AllFormats' };

    // Captured at parse time: the app rewrites the address bar (share links)
    // before PrintKit.init runs, which would drop this parameter.
    const requestedFormat = new URLSearchParams(window.location.search).get('print');

    const state = {
        format: 'stem',
        staged: false,
        pinned: false,
        savedTitle: document.title
    };

    let dialog = null;
    let preview = null;

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */

    function esc(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function hoursMinutes(totalMinutes) {
        const h = Math.floor(totalMinutes / 60);
        return `${h}:${pad(Math.round(totalMinutes % 60))}`;
    }

    function clockAt(plan, minutesFromStart) {
        const total = (plan.input.startHour * 60) + plan.input.startMinute + Math.round(minutesFromStart);
        return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
    }

    function timeDistancePoints(plan) {
        return [{ min: 0, km: 0 }].concat(plan.results.map((row) => ({ min: row.cumHours * 60, km: row.km })));
    }

    function kmAtMinute(plan, minute) {
        const points = timeDistancePoints(plan);
        for (let i = 1; i < points.length; i += 1) {
            if (minute <= points[i].min) {
                const a = points[i - 1];
                const b = points[i];
                const fraction = (minute - a.min) / ((b.min - a.min) || 1);
                return a.km + (fraction * (b.km - a.km));
            }
        }
        return plan.race.distanceKm;
    }

    function elevationAt(race, km) {
        const points = race.elevation || [];
        if (!points.length) return 0;
        for (let i = 1; i < points.length; i += 1) {
            if (km <= points[i].km) {
                const a = points[i - 1];
                const b = points[i];
                const fraction = (km - a.km) / ((b.km - a.km) || 1);
                return a.ele + (fraction * (b.ele - a.ele));
            }
        }
        return points[points.length - 1].ele;
    }

    /* ------------------------------------------------------------------ *
     * Fuel strategy
     * ------------------------------------------------------------------ */

    function buildFuel(plan) {
        const durationMin = plan.input.targetTimeInHours * 60;
        const carbTarget = plan.fuel.carbTarget;
        const gelEvery = Math.max(15, Math.round(((GEL_CARBS_G / carbTarget) * 60) / 5) * 5);
        const events = [];

        for (let t = gelEvery; t <= durationMin - 10; t += gelEvery) {
            events.push({ min: t, type: 'gel', label: 'Gel (~25 g carbs)' });
        }
        if (plan.fuel.sodium) {
            for (let t = 60; t <= durationMin - 15; t += 60) {
                events.push({ min: t, type: 'sodium', label: 'Sodium (300–600 mg/h)' });
            }
        }
        events.sort((a, b) => a.min - b.min || (a.type === 'gel' ? -1 : 1));

        return {
            gelEvery,
            drinkEvery: plan.fuel.drinkInterval,
            carbTarget,
            sodium: plan.fuel.sodium,
            totalCarbs: Math.round(carbTarget * plan.input.targetTimeInHours),
            gelCount: events.filter((event) => event.type === 'gel').length,
            bottles: Math.max(2, Math.ceil(plan.input.targetTimeInHours)),
            events: events.map((event) => ({
                ...event,
                km: kmAtMinute(plan, event.min),
                clock: clockAt(plan, event.min),
                elapsed: hoursMinutes(event.min)
            }))
        };
    }

    /* ------------------------------------------------------------------ *
     * Templates
     * ------------------------------------------------------------------ */

    function renderStemCard(plan, fuel) {
        const rows = plan.results.map((row) => `
            <div class="stem-row${row.km >= plan.race.distanceKm ? ' is-finish' : ''}">
                <span class="stem-km">${row.km.toFixed(0)}</span>
                <span class="stem-name">${esc(row.shortName)}</span>
                <span class="stem-eta">${row.timeOfDay}</span>
            </div>`).join('');
        const notes = plan.notes.slice(0, 2).map((note) => `<div class="stem-note">▸ ${esc(note)}</div>`).join('');
        return `
        <article class="stem-card">
            <header class="stem-head">
                <span class="stem-race">${esc(plan.race.shortName)}</span>
                <span class="stem-target">${esc(plan.summary.targetShort)}</span>
            </header>
            <div class="stem-sub">AVG ${esc(plan.summary.avgSpeed)} km/h · START ${esc(plan.summary.startClock)}</div>
            <div class="stem-rows">${rows}</div>
            <div class="stem-fuel">GEL ${fuel.gelEvery}′ · SIP ${fuel.drinkEvery}′ · ${fuel.carbTarget} g/h${fuel.sodium ? ' · SALT 60′' : ''}</div>
            ${notes ? `<div class="stem-notes">${notes}</div>` : ''}
        </article>`;
    }

    function renderTubeStrip(plan, fuel) {
        const distance = plan.race.distanceKm;
        const pos = (km) => `${((km / distance) * 100).toFixed(2)}%`;

        const checkpoints = plan.results.map((row) => `
            <div class="tube-cp${row.km >= distance ? ' is-finish' : ''}" style="left:${pos(row.km)}">
                <span class="tube-cp-km">${row.km.toFixed(0)}</span>
                <span class="tube-cp-eta">${row.timeOfDay}</span>
                <span class="tube-cp-name">${esc(row.shortName)}</span>
            </div>`).join('');

        const climbs = (plan.race.climbs || []).map((climb) => `
            <div class="tube-climb" style="left:${pos(climb.km)}">▲<em>${esc(climb.name)}</em></div>`).join('');

        // Dodge markers that land at (almost) the same km — e.g. a gel and a
        // sodium reminder due on the same minute — so both stay readable.
        const minGap = distance * 0.017;
        let previousKm = -Infinity;
        const fuelMarks = fuel.events
            .map((event) => ({ ...event }))
            .sort((a, b) => a.km - b.km)
            .map((event) => {
                if (event.km - previousKm < minGap) event.km = previousKm + minGap;
                previousKm = event.km;
                return `<span class="tube-fuel-mark tube-${event.type}" style="left:${pos(Math.min(event.km, distance))}">${event.type === 'gel' ? 'G' : 'S'}</span>`;
            }).join('');

        const notesLine = plan.notes.slice(0, 3).join('  ·  ');

        return `
        <article class="tube-strip">
            <div class="tube-head">
                <span class="tube-race">${esc(plan.race.shortName)}</span>
                <span class="tube-target">TARGET ${esc(plan.summary.targetShort)} · AVG ${esc(plan.summary.avgSpeed)} km/h · GEL ${fuel.gelEvery}′ · SIP ${fuel.drinkEvery}′</span>
                <span class="tube-finish">FINISH ${esc(plan.summary.finishClock)}</span>
            </div>
            <div class="tube-track">
                <div class="tube-climbs">${climbs}</div>
                <div class="tube-bar">${fuelMarks}</div>
                <div class="tube-cps">
                    <div class="tube-cp is-start" style="left:0%">
                        <span class="tube-cp-km">0</span>
                        <span class="tube-cp-eta">${esc(plan.summary.startClock)}</span>
                        <span class="tube-cp-name">Start</span>
                    </div>
                    ${checkpoints}
                </div>
            </div>
            <div class="tube-foot">
                <span class="tube-legend">G gel · S salt · ▲ climb</span>
                ${notesLine ? `<span class="tube-notes">${esc(notesLine)}</span>` : ''}
            </div>
        </article>`;
    }

    function renderElevationSvg(plan) {
        const race = plan.race;
        const points = race.elevation || [];
        if (points.length < 2) return '';

        const width = 1000;
        const height = 250;
        const padLeft = 36;
        const padRight = 14;
        const padTop = 26;
        const padBottom = 40;
        const maxEle = Math.max(...points.map((p) => p.ele)) * 1.08;

        const x = (km) => padLeft + ((km / race.distanceKm) * (width - padLeft - padRight));
        const y = (ele) => padTop + ((1 - (ele / maxEle)) * (height - padTop - padBottom));

        const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.km).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ');
        const area = `${line} L${x(race.distanceKm).toFixed(1)},${height - padBottom} L${x(0).toFixed(1)},${height - padBottom} Z`;

        const checkpointMarks = plan.results.map((row) => `
            <line x1="${x(row.km).toFixed(1)}" y1="${padTop}" x2="${x(row.km).toFixed(1)}" y2="${height - padBottom}" class="elev-cp-line"/>
            <text x="${x(row.km).toFixed(1)}" y="${height - padBottom + 14}" class="elev-cp-km">${row.km.toFixed(0)}</text>
            <text x="${x(row.km).toFixed(1)}" y="${height - padBottom + 27}" class="elev-cp-eta">${row.timeOfDay}</text>`).join('');

        const climbMarks = (race.climbs || []).map((climb) => {
            const cx = Math.min(Math.max(x(climb.km), 60), width - 60);
            return `<text x="${cx.toFixed(1)}" y="${(y(elevationAt(race, climb.km)) - 10).toFixed(1)}" class="elev-climb">▲ ${esc(climb.name)}</text>`;
        }).join('');

        return `
        <svg viewBox="0 0 ${width} ${height}" class="elev-svg" role="img" aria-label="Route elevation profile">
            <path d="${area}" class="elev-area"/>
            <path d="${line}" class="elev-line"/>
            ${checkpointMarks}
            ${climbMarks}
            <text x="${padLeft}" y="${padTop - 10}" class="elev-axis">Elevation (m, indicative) with checkpoint km and arrival times</text>
        </svg>`;
    }

    function renderFullPlan(plan, fuel) {
        const race = plan.race;

        const inputCells = [
            ['Target finish', plan.summary.targetTime],
            ['Race start', plan.summary.startClock],
            ['Pacing strategy', plan.summary.strategyLabel],
            ['Required average', `${plan.summary.avgSpeed} km/h`],
            ['Carb target', `${fuel.carbTarget} g/h`],
            ['Drink reminder', `Every ${fuel.drinkEvery} min`]
        ].map(([label, value]) => `<div class="plan-input"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');

        const paceRows = plan.results.map((row) => `
            <tr>
                <td>${esc(row.name)}</td>
                <td>${row.totalDist}</td>
                <td>${row.timeOfDay}</td>
                <td>${row.timeToPoint}</td>
                <td>${row.splitTime}</td>
                <td>${row.speedOnSplit.toFixed(1)}</td>
                <td>${row.movingAvgSpeed.toFixed(1)}</td>
            </tr>`).join('');

        const fuelRows = fuel.events.map((event) => `
            <tr class="fuel-${event.type}">
                <td>${event.elapsed}</td>
                <td>${event.clock}</td>
                <td>${event.km.toFixed(0)} km</td>
                <td>${esc(event.label)}</td>
            </tr>`).join('');

        const segmentCards = plan.results.map((row, index) => `
            <div class="seg-card">
                <div class="seg-top">
                    <span class="seg-index">${pad(index + 1)}</span>
                    <strong>${esc(row.shortName)}</strong>
                    <span class="seg-range">${index === 0 ? '0.0' : plan.results[index - 1].totalDist}–${row.totalDist} km</span>
                </div>
                <div class="seg-metrics">
                    <span><em>Split</em>${row.splitTime}</span>
                    <span><em>Speed</em>${row.speedOnSplit.toFixed(1)} km/h</span>
                    <span><em>Arrive</em>${row.timeOfDay}</span>
                </div>
                ${row.note ? `<p class="seg-note">${esc(row.note)}</p>` : ''}
            </div>`).join('');

        const notesBlock = plan.notes.length
            ? `<ul class="plan-notes">${plan.notes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul>`
            : '<ul class="plan-notes plan-notes-empty"><li></li><li></li><li></li></ul>';

        const pageOne = `
        <section class="print-page plan-page">
            <header class="plan-header">
                <div>
                    <p class="plan-kicker">Race pacing plan</p>
                    <h1>${esc(race.name)}</h1>
                    <p class="plan-subtitle">${esc(race.startLocation)} → ${esc(race.finishLocation)} · ${race.distanceKm.toFixed(0)} km · ${esc(race.edition)}</p>
                </div>
                <div class="plan-target-box">
                    <span>Target</span>
                    <strong>${esc(plan.summary.targetTime)}</strong>
                    <span>${esc(plan.summary.avgSpeed)} km/h · finish ${esc(plan.summary.finishClock)}</span>
                </div>
            </header>
            <h2>Rider inputs</h2>
            <div class="plan-inputs">${inputCells}</div>
            <h2>Checkpoint pacing</h2>
            <table class="plan-table">
                <thead><tr><th>Checkpoint</th><th>Total km</th><th>Arrival</th><th>Elapsed</th><th>Split</th><th>Split km/h</th><th>Avg km/h</th></tr></thead>
                <tbody>${paceRows}</tbody>
            </table>
            <h2>Route profile</h2>
            ${renderElevationSvg(plan)}
            <p class="plan-footnote">${esc(race.elevationNote || '')}</p>
        </section>`;

        const pageTwo = `
        <section class="print-page plan-page">
            <h2>Fuel strategy</h2>
            <p class="plan-lead">Target ${fuel.carbTarget} g carbs per hour ≈ <strong>${fuel.totalCarbs} g total</strong>. Take a gel every <strong>${fuel.gelEvery} minutes</strong> (~${fuel.gelCount} gels). Carry one spare.${fuel.sodium ? ' Take 300–600 mg sodium each hour — more in heat.' : ''}</p>
            <table class="plan-table fuel-table">
                <thead><tr><th>Elapsed</th><th>Clock</th><th>≈ Distance</th><th>Action</th></tr></thead>
                <tbody>${fuelRows}</tbody>
            </table>
            <h2>Hydration strategy</h2>
            <p class="plan-lead">Sip every <strong>${fuel.drinkEvery} minutes</strong> — small sips beat big gulps. Budget 500–750 ml per hour (~${fuel.bottles} bottles for a ${esc(plan.summary.targetTime)} ride); refill at the water tables rather than carrying everything.</p>
            <h2>Segment breakdown</h2>
            <div class="seg-grid">${segmentCards}</div>
            <h2>Rider notes</h2>
            ${notesBlock}
            <footer class="plan-footer">
                <span>${esc(race.name)} · generated by the Amashova Pacing Calculator (free community tool)</span>
                <span>Guidance only — weather, bunch dynamics and route changes affect real times.</span>
            </footer>
        </section>`;

        return pageOne + pageTwo;
    }

    /* ------------------------------------------------------------------ *
     * Sheets — A4 pages combining templates with cut lines
     * ------------------------------------------------------------------ */

    function renderCardsSheet(plan, fuel, which) {
        const stem = which !== 'tube' ? `
            <div class="cut-stack">
                <div class="cut-box stem-box">${renderStemCard(plan, fuel)}</div>
                <span class="cut-label">✂ stem card · 90 × 60 mm</span>
                <div class="cut-box stem-box">${renderStemCard(plan, fuel)}</div>
                <span class="cut-label">✂ spare copy — pocket or saddle bag</span>
            </div>` : '';
        const tube = which !== 'stem' ? `
            <div class="cut-stack">
                <div class="cut-box tube-box"><div class="tube-rotor">${renderTubeStrip(plan, fuel)}</div></div>
                <span class="cut-label">✂ top tube strip · 220 × 40 mm (rotate after cutting)</span>
            </div>` : '';
        return `
        <section class="print-page cards-page">
            <header class="cards-head">
                <strong>${esc(plan.race.name)}</strong> — race cards · target ${esc(plan.summary.targetTime)} ·
                print at 100% scale, cut along dashed lines, cover with clear tape or laminate.
            </header>
            <div class="cards-area">${stem}${tube}</div>
        </section>`;
    }

    function sheetsFor(format, plan) {
        const fuel = buildFuel(plan);
        switch (format) {
            case 'stem': return renderCardsSheet(plan, fuel, 'stem');
            case 'tube': return renderCardsSheet(plan, fuel, 'tube');
            case 'full': return renderFullPlan(plan, fuel);
            case 'all': return renderCardsSheet(plan, fuel, 'both') + renderFullPlan(plan, fuel);
            default: return renderFullPlan(plan, fuel);
        }
    }

    /* ------------------------------------------------------------------ *
     * Staging + printing
     * ------------------------------------------------------------------ */

    function printRoot() {
        return document.getElementById('printRoot');
    }

    function fileName(plan, format) {
        const raceSlug = plan.race.shortName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const timeSlug = plan.summary.targetShort.replace(':', 'h');
        return `${raceSlug}_${FORMAT_LABELS[format] || 'Print'}_${timeSlug}`;
    }

    function stage(format, plan) {
        printRoot().innerHTML = sheetsFor(format, plan);
        state.staged = true;
    }

    function unstage() {
        if (state.pinned) return;
        printRoot().innerHTML = '';
        state.staged = false;
        document.title = state.savedTitle;
    }

    function printFormat(format) {
        const plan = window.getPlanData && window.getPlanData();
        if (!plan) return;
        stage(format, plan);
        state.savedTitle = document.title;
        document.title = fileName(plan, format);
        window.print();
    }

    /* ------------------------------------------------------------------ *
     * Preview dialog
     * ------------------------------------------------------------------ */

    function renderPreview() {
        const plan = window.getPlanData && window.getPlanData();
        if (!plan) {
            preview.innerHTML = '<p class="preview-empty">Enter a valid target time to preview the plan.</p>';
            return;
        }
        preview.innerHTML = `<div class="preview-clip"><div class="preview-scale">${sheetsFor(state.format, plan)}</div></div>`;
        window.requestAnimationFrame(fitPreview);
    }

    function fitPreview() {
        const clip = preview.querySelector('.preview-clip');
        const scaleBox = preview.querySelector('.preview-scale');
        const page = preview.querySelector('.print-page');
        if (!clip || !scaleBox || !page) return;
        const available = preview.clientWidth - 24;
        const scale = Math.min(1, available / page.offsetWidth);
        scaleBox.style.transform = `scale(${scale})`;
        scaleBox.style.transformOrigin = 'top left';
        clip.style.height = `${scaleBox.getBoundingClientRect().height}px`;
    }

    function selectFormat(format) {
        state.format = format;
        dialog.querySelectorAll('.format-option').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.format === format));
        });
        renderPreview();
    }

    function open() {
        const plan = window.getPlanData && window.getPlanData();
        if (!plan || !dialog || typeof dialog.showModal !== 'function') {
            printFormat('full');
            return;
        }
        renderPreview();
        dialog.showModal();
    }

    /* ------------------------------------------------------------------ *
     * Init
     * ------------------------------------------------------------------ */

    function init() {
        dialog = document.getElementById('printDialog');
        preview = document.getElementById('printPreview');

        if (dialog) {
            dialog.querySelectorAll('.format-option').forEach((button) => {
                button.addEventListener('click', () => selectFormat(button.dataset.format));
            });
            document.getElementById('dialogPrintButton').addEventListener('click', () => printFormat(state.format));
        }
        window.addEventListener('resize', () => {
            if (dialog && dialog.open) fitPreview();
        });

        // Ctrl/Cmd+P without opening the preview still produces the full plan
        // instead of a screenshot of the app UI.
        window.addEventListener('beforeprint', () => {
            if (state.staged) return;
            const plan = window.getPlanData && window.getPlanData();
            if (plan) stage('full', plan);
        });
        window.addEventListener('afterprint', unstage);

        // ?print=<format> stages a format at load — used for deep links and
        // headless PDF generation.
        const requested = requestedFormat;
        if (FORMATS.includes(requested)) {
            const plan = window.getPlanData && window.getPlanData();
            if (plan) {
                state.format = requested;
                state.pinned = true;
                stage(requested, plan);
                document.title = fileName(plan, requested);
            }
        }
    }

    window.PrintKit = { init, open, printFormat };
}());

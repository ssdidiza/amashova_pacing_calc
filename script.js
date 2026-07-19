'use strict';

const elements = {
    targetHr: document.getElementById('targetHr'),
    targetMin: document.getElementById('targetMin'),
    targetTimeSlider: document.getElementById('targetTimeSlider'),
    startTime: document.getElementById('startTime'),
    pacingStrategy: document.getElementById('pacingStrategy'),
    strategyDescription: document.getElementById('strategyDescription'),
    timeError: document.getElementById('timeError'),
    totalTime: document.getElementById('totalTime'),
    avgSpeed: document.getElementById('avgSpeed'),
    finishTime: document.getElementById('finishTime'),
    planSummary: document.getElementById('planSummary'),
    resultsTableBody: document.getElementById('resultsTableBody'),
    mobileResults: document.getElementById('mobileResults'),
    paceChart: document.getElementById('paceChart'),
    shareButton: document.getElementById('shareButton'),
    printButton: document.getElementById('printButton'),
    exportButton: document.getElementById('exportButton'),
    actionStatus: document.getElementById('actionStatus'),
    carbTarget: document.getElementById('carbTarget'),
    drinkInterval: document.getElementById('drinkInterval'),
    sodiumReminders: document.getElementById('sodiumReminders'),
    riderNotes: document.getElementById('riderNotes'),
    themeToggle: document.getElementById('themeToggle'),
    body: document.body
};

let paceChart = null;
let lastCalculatedResults = [];

// Race configuration. Calculations and every print template read from this
// object only, so a different race can be loaded by swapping the config
// (e.g. built from GPX or a race data file) without touching the templates.
// Calculation inputs intentionally retained from the previous live version.
const raceConfig = {
    id: 'amashova-classic-106',
    name: 'Amashova Durban Classic',
    shortName: 'AMASHOVA 106',
    edition: 'October 2026',
    distanceKm: 106.0,
    startLocation: 'Pietermaritzburg',
    finishLocation: 'Suncoast, Durban',
    checkpoints: [
        { name: 'WT1 Thornville', shortName: 'Thornville', dist: 24.5, totalDist: 24.5, note: 'Rolling start on the drags out of PMB. Settle in, do not surge.' },
        { name: 'WT2 Cato Ridge', shortName: 'Cato Ridge', dist: 17.3, totalDist: 41.8, note: 'Steady rolling terrain. Fuel and drink early, before you need it.' },
        { name: 'WT3 Wall of Fame', shortName: 'Wall of Fame', dist: 13.5, totalDist: 55.3, note: 'Inchanga sits in this stretch. Hold your own pace on the climb.' },
        { name: 'Gilletts Station', shortName: 'Gilletts', dist: 19.2, totalDist: 74.5, note: 'Botha’s Hill then fast descending. Stay alert in the bunch.' },
        { name: '45th Cutting', shortName: '45th Cutting', dist: 19.2, totalDist: 93.7, note: 'Long downhill run towards town. Recover, but keep eating.' },
        { name: 'Finish Suncoast', shortName: 'Finish', dist: 12.3, totalDist: 106.0, note: 'Flat run-in along the beachfront. Empty the tank safely.' }
    ],
    // Approximate locations of the marked climbs, used on the top tube strip
    // and the elevation profile.
    climbs: [
        { name: 'Ashburton drag', km: 10 },
        { name: 'Inchanga', km: 46 },
        { name: 'Botha’s Hill', km: 58 },
        { name: '45th Cutting', km: 92 }
    ],
    // Indicative elevation profile (metres) for the print templates.
    elevation: [
        { km: 0, ele: 650 }, { km: 5, ele: 690 }, { km: 10, ele: 760 }, { km: 15, ele: 780 },
        { km: 20, ele: 730 }, { km: 24.5, ele: 710 }, { km: 30, ele: 690 }, { km: 35, ele: 660 },
        { km: 41.8, ele: 720 }, { km: 46, ele: 770 }, { km: 50, ele: 700 }, { km: 55.3, ele: 620 },
        { km: 58, ele: 720 }, { km: 62, ele: 680 }, { km: 66, ele: 620 }, { km: 70, ele: 580 },
        { km: 74.5, ele: 520 }, { km: 80, ele: 420 }, { km: 85, ele: 330 }, { km: 90, ele: 180 },
        { km: 93.7, ele: 110 }, { km: 98, ele: 40 }, { km: 102, ele: 15 }, { km: 106, ele: 5 }
    ],
    elevationNote: 'Indicative profile — confirm against official route data before race day.'
};

const segments = raceConfig.checkpoints;

const pacingStrategies = {
    even: [1.1577, 1.0815, 1.0915, 0.9512, 0.7948, 0.8830],
    conservative: [1.25, 1.10, 1.09, 0.94, 0.78, 0.80],
    aggressive: [1.05, 1.06, 1.10, 0.96, 0.81, 0.98]
};

const strategyDescriptions = {
    even: 'Balances effort against the route profile across all six segments.',
    conservative: 'Starts more cautiously and preserves more effort for the second half.',
    aggressive: 'Front-loads effort. Higher risk and better suited to experienced riders.'
};

const totalRaceDistance = raceConfig.distanceKm;
const STORAGE_KEY = 'amashovaPacingSettingsV2';
let lastInput = null;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function readInputs() {
    const hours = Number.parseInt(elements.targetHr.value, 10);
    const minutes = Number.parseInt(elements.targetMin.value, 10);
    const [startHour, startMinute] = elements.startTime.value.split(':').map(Number);

    if (![hours, minutes, startHour, startMinute].every(Number.isFinite)) {
        return { error: 'Enter a valid target time and race start time.' };
    }

    if (hours < 2 || hours > 8 || minutes < 0 || minutes > 59) {
        return { error: 'Target time must be between 2:00 and 8:59.' };
    }

    return {
        hours,
        minutes,
        targetTimeInHours: hours + (minutes / 60),
        startHour,
        startMinute,
        strategy: elements.pacingStrategy.value
    };
}

function calculateResults(input) {
    const timeFactors = pacingStrategies[input.strategy];
    const proportionalContributions = segments.map((segment, index) => segment.dist * timeFactors[index]);
    const sumProportionalContributions = proportionalContributions.reduce((sum, value) => sum + value, 0);
    const startTime = new Date(2000, 0, 1, input.startHour, input.startMinute, 0, 0);

    let cumulativeTimeInHours = 0;

    return segments.map((segment, index) => {
        const splitHours = (proportionalContributions[index] / sumProportionalContributions) * input.targetTimeInHours;
        const speedOnSplit = segment.dist / splitHours;
        cumulativeTimeInHours += splitHours;
        const movingAverage = segment.totalDist / cumulativeTimeInHours;
        const arrivalTime = new Date(startTime.getTime() + (cumulativeTimeInHours * 3600000));

        return {
            name: segment.name,
            shortName: segment.shortName || segment.name,
            note: segment.note || '',
            km: segment.totalDist,
            segmentKm: segment.dist,
            cumHours: cumulativeTimeInHours,
            splitHours,
            dist: segment.dist.toFixed(1),
            totalDist: segment.totalDist.toFixed(1),
            timeToPoint: formatDuration(cumulativeTimeInHours),
            timeOfDay: formatClock(arrivalTime),
            splitTime: formatDuration(splitHours),
            speedOnSplit: Number(speedOnSplit.toFixed(2)),
            movingAvgSpeed: Number(movingAverage.toFixed(2))
        };
    });
}

function formatDuration(hours) {
    const totalSeconds = Math.round(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatClock(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderTable(results) {
    elements.resultsTableBody.replaceChildren(...results.map((result) => {
        const row = document.createElement('tr');
        const values = [
            result.name,
            result.totalDist,
            result.timeOfDay,
            result.timeToPoint,
            result.splitTime,
            `${result.speedOnSplit.toFixed(2)} km/h`,
            `${result.movingAvgSpeed.toFixed(2)} km/h`
        ];
        values.forEach((value) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        return row;
    }));
}

function renderMobileCards(results) {
    elements.mobileResults.replaceChildren(...results.map((result, index) => {
        const article = document.createElement('article');
        article.className = 'checkpoint-card';
        article.innerHTML = `
            <div class="checkpoint-topline">
                <span class="checkpoint-number">${String(index + 1).padStart(2, '0')}</span>
                <span>${result.totalDist} km</span>
            </div>
            <h3>${result.name}</h3>
            <div class="checkpoint-metrics">
                <div><span>Arrival</span><strong>${result.timeOfDay}</strong></div>
                <div><span>Elapsed</span><strong>${result.timeToPoint}</strong></div>
                <div><span>Split</span><strong>${result.splitTime}</strong></div>
                <div><span>Speed</span><strong>${result.speedOnSplit.toFixed(2)} km/h</strong></div>
            </div>
        `;
        return article;
    }));
}

function renderChart(results) {
    if (typeof Chart === 'undefined') return;
    if (paceChart) paceChart.destroy();

    const styles = getComputedStyle(elements.body);
    const textColor = styles.getPropertyValue('--text-muted').trim();
    const gridColor = styles.getPropertyValue('--border').trim();
    const accent = styles.getPropertyValue('--accent').trim();

    paceChart = new Chart(elements.paceChart, {
        type: 'bar',
        data: {
            labels: results.map((result) => result.name.replace('WT1 ', '').replace('WT2 ', '').replace('WT3 ', '')),
            datasets: [{
                data: results.map((result) => result.speedOnSplit),
                backgroundColor: accent,
                borderRadius: 8,
                maxBarThickness: 56
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => `${context.raw.toFixed(2)} km/h` } }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: (value) => `${value} km/h` }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, maxRotation: 0, autoSkip: false }
                }
            }
        }
    });
}

function clearResults() {
    lastCalculatedResults = [];
    elements.resultsTableBody.replaceChildren();
    elements.mobileResults.replaceChildren();
    if (paceChart) {
        paceChart.destroy();
        paceChart = null;
    }
    elements.totalTime.textContent = '--:--:--';
    elements.avgSpeed.textContent = '0.00';
    elements.finishTime.textContent = '--:--';
    elements.planSummary.textContent = '';
}

function updatePlan() {
    const input = readInputs();
    elements.strategyDescription.textContent = strategyDescriptions[elements.pacingStrategy.value];

    if (input.error) {
        elements.timeError.textContent = input.error;
        clearResults();
        return;
    }

    elements.timeError.textContent = '';
    lastInput = input;
    lastCalculatedResults = calculateResults(input);
    const finish = lastCalculatedResults[lastCalculatedResults.length - 1];

    elements.totalTime.textContent = formatDuration(input.targetTimeInHours);
    elements.avgSpeed.textContent = (totalRaceDistance / input.targetTimeInHours).toFixed(2);
    elements.finishTime.textContent = finish.timeOfDay;
    elements.planSummary.textContent = `${formatDuration(input.targetTimeInHours)} target · ${elements.pacingStrategy.options[elements.pacingStrategy.selectedIndex].text}`;

    renderTable(lastCalculatedResults);
    renderMobileCards(lastCalculatedResults);
    renderChart(lastCalculatedResults);
    saveSettings();
    updateAddressBar();
}

function syncSliderFromTime() {
    const hours = Number.parseInt(elements.targetHr.value, 10) || 0;
    const minutes = Number.parseInt(elements.targetMin.value, 10) || 0;
    elements.targetTimeSlider.value = String(clamp((hours * 60) + minutes, 120, 480));
}

function syncTimeFromSlider() {
    const totalMinutes = Number.parseInt(elements.targetTimeSlider.value, 10);
    elements.targetHr.value = String(Math.floor(totalMinutes / 60));
    elements.targetMin.value = String(totalMinutes % 60);
}

function currentQuery() {
    const params = new URLSearchParams();
    params.set('h', elements.targetHr.value);
    params.set('m', elements.targetMin.value);
    params.set('start', elements.startTime.value);
    params.set('strategy', elements.pacingStrategy.value);
    params.set('carbs', elements.carbTarget.value);
    params.set('drink', elements.drinkInterval.value);
    if (elements.sodiumReminders.checked) params.set('sodium', '1');
    if (elements.riderNotes.value.trim()) params.set('notes', elements.riderNotes.value.trim());
    return params;
}

function updateAddressBar() {
    const url = new URL(window.location.href);
    url.search = currentQuery().toString();
    window.history.replaceState({}, '', url);
}

async function copyShareLink() {
    updateAddressBar();
    try {
        await navigator.clipboard.writeText(window.location.href);
        showStatus('Share link copied.');
    } catch (error) {
        const temporaryInput = document.createElement('input');
        temporaryInput.value = window.location.href;
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        document.execCommand('copy');
        temporaryInput.remove();
        showStatus('Share link copied.');
    }
}

function exportToCSV() {
    if (!lastCalculatedResults.length) return;

    const header = ['Checkpoint', 'Segment km', 'Total km', 'Arrival', 'Elapsed', 'Split', 'Split speed km/h', 'Moving average km/h'];
    const rows = lastCalculatedResults.map((row) => [
        row.name, row.dist, row.totalDist, row.timeOfDay, row.timeToPoint,
        row.splitTime, row.speedOnSplit, row.movingAvgSpeed
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Amashova_Pacing_${elements.targetHr.value}h${String(elements.targetMin.value).padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
        URL.revokeObjectURL(link.href);
        link.remove();
    }, 100);
    showStatus('CSV exported.');
}

function showStatus(message) {
    elements.actionStatus.textContent = message;
    window.clearTimeout(showStatus.timeout);
    showStatus.timeout = window.setTimeout(() => {
        elements.actionStatus.textContent = '';
    }, 3000);
}

function saveSettings() {
    const settings = {
        h: elements.targetHr.value,
        m: elements.targetMin.value,
        start: elements.startTime.value,
        strategy: elements.pacingStrategy.value,
        carbs: elements.carbTarget.value,
        drink: elements.drinkInterval.value,
        sodium: elements.sodiumReminders.checked ? '1' : '',
        notes: elements.riderNotes.value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applySettings(settings) {
    if (!settings) return;
    elements.targetHr.value = settings.h || '4';
    elements.targetMin.value = settings.m || '0';
    elements.startTime.value = settings.start || '06:00';
    elements.pacingStrategy.value = pacingStrategies[settings.strategy] ? settings.strategy : 'even';
    if (['40', '60', '90'].includes(settings.carbs)) elements.carbTarget.value = settings.carbs;
    if (['10', '15', '20'].includes(settings.drink)) elements.drinkInterval.value = settings.drink;
    elements.sodiumReminders.checked = settings.sodium === '1';
    if (typeof settings.notes === 'string') elements.riderNotes.value = settings.notes.slice(0, 280);
}

function loadInitialSettings() {
    const params = new URLSearchParams(window.location.search);
    const hasQuerySettings = ['h', 'm', 'start', 'strategy'].some((key) => params.has(key));

    if (hasQuerySettings) {
        applySettings({
            h: params.get('h'),
            m: params.get('m'),
            start: params.get('start'),
            strategy: params.get('strategy'),
            carbs: params.get('carbs'),
            drink: params.get('drink'),
            sodium: params.get('sodium'),
            notes: params.get('notes') || ''
        });
    } else {
        try {
            applySettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    syncSliderFromTime();
}

function applyTheme(theme) {
    elements.body.dataset.theme = theme;
    elements.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    localStorage.setItem('amashovaTheme', theme);
    if (lastCalculatedResults.length) renderChart(lastCalculatedResults);
}

function debounce(callback, delay = 120) {
    let timer;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), delay);
    };
}

function bindEvents() {
    const debouncedUpdate = debounce(updatePlan);

    [elements.targetHr, elements.targetMin, elements.startTime].forEach((input) => {
        input.addEventListener('input', () => {
            syncSliderFromTime();
            debouncedUpdate();
        });
    });

    elements.targetTimeSlider.addEventListener('input', () => {
        syncTimeFromSlider();
        debouncedUpdate();
    });
    elements.pacingStrategy.addEventListener('change', updatePlan);

    [elements.carbTarget, elements.drinkInterval].forEach((input) => {
        input.addEventListener('change', () => {
            saveSettings();
            updateAddressBar();
        });
    });
    elements.sodiumReminders.addEventListener('change', () => {
        saveSettings();
        updateAddressBar();
    });
    elements.riderNotes.addEventListener('input', debounce(() => {
        saveSettings();
        updateAddressBar();
    }, 250));

    elements.shareButton.addEventListener('click', copyShareLink);
    elements.printButton.addEventListener('click', () => {
        if (window.PrintKit) {
            window.PrintKit.open();
        } else {
            window.print();
        }
    });
    elements.exportButton.addEventListener('click', exportToCSV);
    elements.themeToggle.addEventListener('click', () => {
        applyTheme(elements.body.dataset.theme === 'dark' ? 'light' : 'dark');
    });
}

// Snapshot of the current plan for the print module. Returns null while the
// inputs are invalid. Everything the print templates need lives on this
// object, keeping them independent of the app's DOM and of any specific race.
window.getPlanData = function getPlanData() {
    if (!lastInput || !lastCalculatedResults.length) return null;
    const finish = lastCalculatedResults[lastCalculatedResults.length - 1];
    const strategySelect = elements.pacingStrategy;
    return {
        race: raceConfig,
        input: { ...lastInput },
        results: lastCalculatedResults.map((row) => ({ ...row })),
        summary: {
            targetTime: formatDuration(lastInput.targetTimeInHours),
            targetShort: `${lastInput.hours}:${String(lastInput.minutes).padStart(2, '0')}`,
            avgSpeed: (totalRaceDistance / lastInput.targetTimeInHours).toFixed(1),
            startClock: `${String(lastInput.startHour).padStart(2, '0')}:${String(lastInput.startMinute).padStart(2, '0')}`,
            finishClock: finish.timeOfDay,
            strategyLabel: strategySelect.options[strategySelect.selectedIndex].text
        },
        fuel: {
            carbTarget: Number.parseInt(elements.carbTarget.value, 10),
            drinkInterval: Number.parseInt(elements.drinkInterval.value, 10),
            sodium: elements.sodiumReminders.checked
        },
        notes: elements.riderNotes.value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 6)
    };
};

function init() {
    applyTheme(localStorage.getItem('amashovaTheme') || 'dark');
    loadInitialSettings();
    bindEvents();
    updatePlan();
    if (window.PrintKit) window.PrintKit.init();
}

init();

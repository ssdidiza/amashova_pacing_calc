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
    raceSelect: document.getElementById('raceSelect'),
    raceTitle: document.getElementById('raceTitle'),
    raceTagline: document.getElementById('raceTagline'),
    raceNotice: document.getElementById('raceNotice'),
    themeToggle: document.getElementById('themeToggle'),
    body: document.body
};

let paceChart = null;
let lastCalculatedResults = [];

// Race registry. Each file in races/ registers a config on window.RACES;
// the calculator and every print template read only from the active config,
// so adding a race is a matter of adding a config (see tools/gpx-to-config.js).
const RACES = window.RACES || {};
const DEFAULT_RACE_ID = 'amashova-106';
let raceConfig = RACES[DEFAULT_RACE_ID] || Object.values(RACES)[0];

const strategyDescriptions = {
    even: 'Balances effort against the route profile across every segment.',
    conservative: 'Starts more cautiously and preserves more effort for the second half.',
    aggressive: 'Front-loads effort. Higher risk and better suited to experienced riders.'
};

const STORAGE_KEY = 'racePacingSettingsV3';
const LEGACY_STORAGE_KEY = 'amashovaPacingSettingsV2';
const DEFAULT_SETTINGS = Object.freeze({
    h: '4',
    m: '0',
    start: '06:00',
    strategy: 'even',
    carbs: '60',
    drink: '15',
    sodium: '',
    notes: ''
});
let settingsStore = null;
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
    const segments = raceConfig.checkpoints;
    const timeFactors = raceConfig.strategies[input.strategy] || raceConfig.strategies.even;
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
            labels: results.map((result) => result.shortName),
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
    elements.avgSpeed.textContent = (raceConfig.distanceKm / input.targetTimeInHours).toFixed(2);
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
    params.set('race', raceConfig.id);
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
    const raceSlug = raceConfig.shortName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    link.download = `${raceSlug}_Pacing_${elements.targetHr.value}h${String(elements.targetMin.value).padStart(2, '0')}.csv`;
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

function persistSettingsStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsStore));
}

function loadSettingsStore() {
    if (settingsStore) return settingsStore;

    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && saved.races && typeof saved.races === 'object') {
            settingsStore = {
                lastRace: RACES[saved.lastRace] ? saved.lastRace : '',
                races: saved.races
            };
            return settingsStore;
        }
    } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
    }

    settingsStore = { lastRace: '', races: {} };

    let legacySettings = null;
    try {
        legacySettings = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    } catch (error) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    if (legacySettings && typeof legacySettings === 'object') {
        const legacyRace = RACES[legacySettings.race]
            ? legacySettings.race
            : raceConfig.id;
        settingsStore.lastRace = legacyRace;
        settingsStore.races[legacyRace] = legacySettings;
        try {
            persistSettingsStore();
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (error) {
            // Keep the legacy value so migration can be retried next time.
        }
    }

    return settingsStore;
}

function saveSettings() {
    const store = loadSettingsStore();
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
    store.lastRace = raceConfig.id;
    store.races[raceConfig.id] = settings;
    persistSettingsStore();
}

function applySettings(settings) {
    const values = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    elements.targetHr.value = values.h || DEFAULT_SETTINGS.h;
    elements.targetMin.value = values.m || DEFAULT_SETTINGS.m;
    elements.startTime.value = values.start || DEFAULT_SETTINGS.start;
    elements.pacingStrategy.value = strategyDescriptions[values.strategy] ? values.strategy : DEFAULT_SETTINGS.strategy;
    elements.carbTarget.value = ['40', '60', '90'].includes(values.carbs) ? values.carbs : DEFAULT_SETTINGS.carbs;
    elements.drinkInterval.value = ['10', '15', '20'].includes(values.drink) ? values.drink : DEFAULT_SETTINGS.drink;
    elements.sodiumReminders.checked = values.sodium === '1';
    elements.riderNotes.value = typeof values.notes === 'string' ? values.notes.slice(0, 280) : '';
}

function loadInitialSettings() {
    const params = new URLSearchParams(window.location.search);
    const store = loadSettingsStore();
    const queryRace = params.get('race');
    const selectedRace = RACES[queryRace]
        ? queryRace
        : (RACES[store.lastRace] ? store.lastRace : raceConfig.id);
    const hasQuerySettings = ['h', 'm', 'start', 'strategy', 'carbs', 'drink', 'sodium', 'notes']
        .some((key) => params.has(key));

    raceConfig = RACES[selectedRace];

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
        applySettings(store.races[raceConfig.id]);
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
    elements.raceSelect.addEventListener('change', () => setRace(elements.raceSelect.value));

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
            avgSpeed: (raceConfig.distanceKm / lastInput.targetTimeInHours).toFixed(1),
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

function populateRacePicker() {
    elements.raceSelect.replaceChildren(...Object.values(RACES).map((race) => {
        const option = document.createElement('option');
        option.value = race.id;
        option.textContent = `${race.name} · ${race.distanceKm.toFixed(0)} km`;
        return option;
    }));
}

function applyRaceToUI() {
    elements.raceTitle.textContent = raceConfig.name;
    elements.raceTagline.textContent = raceConfig.heroCopy || '';
    elements.raceNotice.textContent = raceConfig.notice || '';
    elements.raceNotice.hidden = !raceConfig.notice;
    elements.raceSelect.value = raceConfig.id;
    document.title = `${raceConfig.name} Pacing Calculator`;
}

function setRace(id) {
    if (!RACES[id] || RACES[id] === raceConfig) return;
    saveSettings();
    raceConfig = RACES[id];
    applySettings(loadSettingsStore().races[id]);
    syncSliderFromTime();
    applyRaceToUI();
    updatePlan();
}

function init() {
    applyTheme(localStorage.getItem('amashovaTheme') || 'dark');
    populateRacePicker();
    loadInitialSettings();
    applyRaceToUI();
    bindEvents();
    updatePlan();
    if (window.PrintKit) window.PrintKit.init();
}

init();

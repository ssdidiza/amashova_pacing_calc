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
    themeToggle: document.getElementById('themeToggle'),
    body: document.body
};

let paceChart = null;
let lastCalculatedResults = [];

// Calculation inputs intentionally retained from the previous live version.
const segments = [
    { name: 'WT1 Thornville', dist: 24.5, totalDist: 24.5 },
    { name: 'WT2 Cato Ridge', dist: 17.3, totalDist: 41.8 },
    { name: 'WT3 Wall of Fame', dist: 13.5, totalDist: 55.3 },
    { name: 'Gilletts Station', dist: 19.2, totalDist: 74.5 },
    { name: '45th Cutting', dist: 19.2, totalDist: 93.7 },
    { name: 'Finish Suncoast', dist: 12.3, totalDist: 106.0 }
];

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

const totalRaceDistance = 106.0;
const STORAGE_KEY = 'amashovaPacingSettingsV2';

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

    const styles = getComputedStyle(document.documentElement);
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

function updatePlan() {
    const input = readInputs();
    elements.strategyDescription.textContent = strategyDescriptions[elements.pacingStrategy.value];

    if (input.error) {
        elements.timeError.textContent = input.error;
        return;
    }

    elements.timeError.textContent = '';
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
    URL.revokeObjectURL(link.href);
    link.remove();
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
        strategy: elements.pacingStrategy.value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applySettings(settings) {
    if (!settings) return;
    elements.targetHr.value = settings.h || '4';
    elements.targetMin.value = settings.m || '0';
    elements.startTime.value = settings.start || '06:00';
    elements.pacingStrategy.value = pacingStrategies[settings.strategy] ? settings.strategy : 'even';
}

function loadInitialSettings() {
    const params = new URLSearchParams(window.location.search);
    const hasQuerySettings = ['h', 'm', 'start', 'strategy'].some((key) => params.has(key));

    if (hasQuerySettings) {
        applySettings({
            h: params.get('h'),
            m: params.get('m'),
            start: params.get('start'),
            strategy: params.get('strategy')
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
    elements.shareButton.addEventListener('click', copyShareLink);
    elements.printButton.addEventListener('click', () => window.print());
    elements.exportButton.addEventListener('click', exportToCSV);
    elements.themeToggle.addEventListener('click', () => {
        applyTheme(elements.body.dataset.theme === 'dark' ? 'light' : 'dark');
    });
}

function init() {
    applyTheme(localStorage.getItem('amashovaTheme') || 'dark');
    loadInitialSettings();
    bindEvents();
    updatePlan();
}

init();

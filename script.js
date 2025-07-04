// --- DOM Element Selection ---
const elements = {
    targetHrInput: document.getElementById('targetHr'),
    targetMinInput: document.getElementById('targetMin'),
    targetHrSlider: document.getElementById('targetHrSlider'),
    targetMinSlider: document.getElementById('targetMinSlider'),
    startHrInput: document.getElementById('startHr'),
    startMinInput: document.getElementById('startMin'),
    pacingStrategyInput: document.getElementById('pacingStrategy'),
    resultsTableBody: document.getElementById('resultsTableBody'),
    avgSpeedSpan: document.getElementById('avgSpeed'),
    totalTimeSpan: document.getElementById('totalTime'),
    timeErrorSpan: document.getElementById('timeError'),
    exportButton: document.getElementById('exportButton'),
    themeToggle: document.getElementById('theme-toggle'),
    body: document.body,
    chartContainer: document.querySelector('.chart-container'),
    chartCanvas: document.getElementById('paceChart'),
};

// --- Global State & Data ---
let paceChart = null; // To hold the chart instance
const segments = [
    { name: "WT1 Thornville", dist: 24.5, totalDist: 24.5 }, // Shortened names for chart
    { name: "WT2 Cato Ridge", dist: 17.3, totalDist: 41.8 },
    { name: "WT3 Wall of Fame", dist: 13.5, totalDist: 55.3 },
    { name: "Gilletts Station", dist: 19.2, totalDist: 74.5 },
    { name: "45th Cutting", dist: 19.2, totalDist: 93.7 },
    { name: "Finish Suncoast", dist: 12.3, totalDist: 106.0 }
];
const pacingStrategies = {
    even: [1.1577, 1.0815, 1.0915, 0.9512, 0.7948, 0.8830],
    conservative: [1.25, 1.10, 1.09, 0.94, 0.78, 0.80],
    aggressive: [1.05, 1.06, 1.10, 0.96, 0.81, 0.98]
};
const totalRaceDistance = 106.0;

// --- Main Calculation Function ---
function calculateSplits() {
    elements.timeErrorSpan.textContent = '';

    const targetHr = parseInt(elements.targetHrInput.value) || 0;
    const targetMin = parseInt(elements.targetMinInput.value) || 0;
    const targetTimeInHours = targetHr + (targetMin / 60);

    if (targetTimeInHours <= 0) {
        elements.timeErrorSpan.textContent = 'Target time must be greater than zero.';
        elements.resultsTableBody.innerHTML = '';
        if (paceChart) paceChart.destroy();
        return;
    }

    elements.resultsTableBody.classList.remove('recalculating');
    elements.chartContainer.classList.remove('recalculating');
    void elements.resultsTableBody.offsetWidth;
    elements.resultsTableBody.classList.add('recalculating');
    elements.chartContainer.classList.add('recalculating');

    const startHr = parseInt(elements.startHrInput.value) || 0;
    const startMin = parseInt(elements.startMinInput.value) || 0;
    const selectedPacing = elements.pacingStrategyInput.value;
    const startTime = new Date();
    startTime.setHours(startHr, startMin, 0, 0);

    elements.avgSpeedSpan.textContent = (totalRaceDistance / targetTimeInHours).toFixed(2);
    elements.resultsTableBody.innerHTML = '';

    const timeFactors = pacingStrategies[selectedPacing];
    const proportionalContributions = segments.map((segment, index) => segment.dist * timeFactors[index]);
    const sumProportionalContributions = proportionalContributions.reduce((sum, val) => sum + val, 0);

    let cumulativeTimeInHours = 0;
    const calculatedResults = [];

    for (const [i, segment] of segments.entries()) {
        const actualSplitTimeInHours = (proportionalContributions[i] / sumProportionalContributions) * targetTimeInHours;
        const speedOnSplit = segment.dist / actualSplitTimeInHours;
        cumulativeTimeInHours += actualSplitTimeInHours;
        const movingAvgSpeed = segment.totalDist / cumulativeTimeInHours;
        const arrivalTime = new Date(startTime.getTime() + (cumulativeTimeInHours * 3600 * 1000));

        const resultData = {
            name: segment.name,
            dist: segment.dist.toFixed(1),
            totalDist: segment.totalDist.toFixed(1),
            timeToPoint: formatTime(cumulativeTimeInHours),
            timeOfDay: formatTimeOfDay(arrivalTime),
            splitTime: formatTime(actualSplitTimeInHours),
            speedOnSplit: parseFloat(speedOnSplit.toFixed(2)),
            movingAvgSpeed: movingAvgSpeed.toFixed(2)
        };
        calculatedResults.push(resultData);

        const row = elements.resultsTableBody.insertRow();
        row.insertCell().textContent = resultData.name;
        row.insertCell().textContent = resultData.dist;
        row.insertCell().textContent = resultData.totalDist;
        row.insertCell().textContent = resultData.timeToPoint;
        row.insertCell().textContent = resultData.timeOfDay;
        row.insertCell().textContent = resultData.splitTime;
        row.insertCell().textContent = String(resultData.speedOnSplit);
        row.insertCell().textContent = resultData.movingAvgSpeed;
    }

    window.lastCalculatedResults = calculatedResults;
    renderChart(calculatedResults);
}

// --- Charting Function ---
function renderChart(data) {
    if (paceChart) {
        paceChart.destroy();
    }
    const theme = document.body.getAttribute('data-theme') || 'dark';
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid-color');
    const fontColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-font-color');

    paceChart = new Chart(elements.chartCanvas, {
        type: 'bar',
        data: {
            labels: data.map(row => row.name),
            datasets: [{
                label: 'Speed on Split (km/h)',
                data: data.map(row => row.speedOnSplit),
                backgroundColor: theme === 'dark' ? 'rgba(79, 209, 197, 0.6)' : 'rgba(49, 151, 149, 0.7)',
                borderColor: theme === 'dark' ? 'rgba(79, 209, 197, 1)' : 'rgba(49, 151, 149, 1)',
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Pacing Speed Per Segment', color: fontColor, font: { size: 16 } }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Speed (km/h)', color: fontColor },
                    grid: { color: gridColor },
                    ticks: { color: fontColor }
                },
                x: {
                    grid: { color: 'transparent' },
                    ticks: { color: fontColor }
                }
            }
        }
    });
}

// --- Helper & UI Functions ---
function formatTime(time) { return new Date(time * 3600 * 1000).toISOString().slice(11, 19); }
function formatTimeOfDay(date) { return date.toTimeString().slice(0, 8); }
function updateSummary() {
    const hr = parseInt(elements.targetHrInput.value) || 0;
    const min = parseInt(elements.targetMinInput.value) || 0;
    elements.totalTimeSpan.textContent = `Total Time: ${hr}:${String(min).padStart(2, '0')}:00`;
}
function syncInputs(source, target) { target.value = source.value; }
function setInitialTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    elements.body.setAttribute('data-theme', savedTheme);
    elements.themeToggle.checked = savedTheme === 'light';
}
function toggleTheme() {
    const newTheme = elements.themeToggle.checked ? 'light' : 'dark';
    elements.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (window.lastCalculatedResults) {
        renderChart(window.lastCalculatedResults);
    }
}

// --- CSV Export ---
function exportToCSV() {
    if (!window.lastCalculatedResults) { return; }
    let csvContent = "Point on Route,Dist (km),Total Dist (km),Time to Point,Time of Day,Split Time,Speed on Split (km/h),Moving Average Speed (km/h)\n";
    window.lastCalculatedResults.forEach(row => {
        csvContent += `"${row.name}",${row.dist},${row.totalDist},${row.timeToPoint},${row.timeOfDay},${row.splitTime},${row.speedOnSplit},${row.movingAvgSpeed}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Amashova_Splits_${elements.targetHrInput.value}h${elements.targetMinInput.value}m.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Event Listeners Setup ---
function addEventListeners() {
    const liveInputs = [elements.targetHrInput, elements.targetMinInput, elements.targetHrSlider, elements.targetMinSlider, elements.startHrInput, elements.startMinInput, elements.pacingStrategyInput];
    liveInputs.forEach(input => input.addEventListener('input', () => { updateSummary(); calculateSplits(); }));

    elements.targetHrInput.addEventListener('input', () => syncInputs(elements.targetHrInput, elements.targetHrSlider));
    elements.targetHrSlider.addEventListener('input', () => syncInputs(elements.targetHrSlider, elements.targetHrInput));
    elements.targetMinInput.addEventListener('input', () => syncInputs(elements.targetMinInput, elements.targetMinSlider));
    elements.targetMinSlider.addEventListener('input', () => syncInputs(elements.targetMinSlider, elements.targetMinInput));

    elements.exportButton.addEventListener('click', exportToCSV);
    elements.themeToggle.addEventListener('change', toggleTheme);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setInitialTheme();
    addEventListeners();
    updateSummary();
    calculateSplits();
});
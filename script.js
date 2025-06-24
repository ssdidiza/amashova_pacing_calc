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
    calculateButton: document.getElementById('calculateButton'),
    exportButton: document.getElementById('exportButton'),
    themeToggle: document.getElementById('theme-toggle'),
    body: document.body
};

// --- Race Data & Pacing Strategies ---
const segments = [
    { name: "Water Table 1 Thornville Chicken Farm", dist: 24.5, totalDist: 24.5 },
    { name: "Water Table 2 Cato Ridge", dist: 17.3, totalDist: 41.8 },
    { name: "Water Table 3 Comrades Wall of Fame", dist: 13.5, totalDist: 55.3 },
    { name: "Gilletts Station", dist: 19.2, totalDist: 74.5 },
    { name: "Forty-fifth Cutting", dist: 19.2, totalDist: 93.7 },
    { name: "Finish at Suncoast", dist: 12.3, totalDist: 106.0 }
];
const pacingStrategies = {
    even: [1.1577, 1.0815, 1.0915, 0.9512, 0.7948, 0.8830],
    conservative: [1.25, 1.10, 1.09, 0.94, 0.78, 0.80],
    aggressive: [1.05, 1.06, 1.10, 0.96, 0.81, 0.98]
};
const totalRaceDistance = 106.0;

// --- Main Calculation Function ---
function calculateSplits() {
    elements.timeErrorSpan.textContent = ''; // Clear previous errors

    const targetHr = parseInt(elements.targetHrInput.value) || 0;
    const targetMin = parseInt(elements.targetMinInput.value) || 0;
    const targetTimeInHours = targetHr + (targetMin / 60);

    // Inline Error Handling
    if (targetTimeInHours <= 0) {
        elements.timeErrorSpan.textContent = 'Target time must be greater than zero.';
        elements.resultsTableBody.innerHTML = ''; // Clear table
        return;
    }

    // Visual Feedback for Recalculation
    elements.resultsTableBody.classList.remove('recalculating');
    void elements.resultsTableBody.offsetWidth; // Trigger reflow to restart animation
    elements.resultsTableBody.classList.add('recalculating');

    const startHr = parseInt(elements.startHrInput.value) || 0;
    const startMin = parseInt(elements.startMinInput.value) || 0;
    const selectedPacing = elements.pacingStrategyInput.value;

    const startTime = new Date();
    startTime.setHours(startHr, startMin, 0, 0);

    const overallAvgSpeed = totalRaceDistance / targetTimeInHours;
    elements.avgSpeedSpan.textContent = overallAvgSpeed.toFixed(2);

    elements.resultsTableBody.innerHTML = '';

    const timeFactors = pacingStrategies[selectedPacing];
    const proportionalContributions = segments.map((segment, index) => segment.dist * timeFactors[index]);
    const sumProportionalContributions = proportionalContributions.reduce((sum, val) => sum + val, 0);

    let cumulativeTimeInHours = 0;
    const calculatedResults = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const actualSplitTimeInHours = (proportionalContributions[i] / sumProportionalContributions) * targetTimeInHours;
        const speedOnSplit = segment.dist / actualSplitTimeInHours;
        cumulativeTimeInHours += actualSplitTimeInHours;
        const movingAvgSpeed = segment.totalDist / cumulativeTimeInHours;
        const cumulativeSeconds = cumulativeTimeInHours * 3600;
        const arrivalTime = new Date(startTime.getTime() + cumulativeSeconds * 1000);

        const resultData = {
            name: segment.name,
            dist: segment.dist.toFixed(1),
            totalDist: segment.totalDist.toFixed(1),
            timeToPoint: formatTime(cumulativeTimeInHours),
            timeOfDay: formatTimeOfDay(arrivalTime),
            splitTime: formatTime(actualSplitTimeInHours),
            speedOnSplit: speedOnSplit.toFixed(2),
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
        row.insertCell().textContent = resultData.speedOnSplit;
        row.insertCell().textContent = resultData.movingAvgSpeed;
    }

    window.lastCalculatedResults = calculatedResults;
}

// --- Helper & UI Functions ---
function formatTime(timeInHours) {
    const totalSeconds = Math.round(timeInHours * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTimeOfDay(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

function updateSummary() {
    const hr = parseInt(elements.targetHrInput.value) || 0;
    const min = parseInt(elements.targetMinInput.value) || 0;
    elements.totalTimeSpan.textContent = `Total Time: ${hr}:${String(min).padStart(2, '0')}:00`;
}

function syncInputs(source, target) {
    target.value = source.value;
}

// --- Theming ---
function setInitialTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    elements.body.setAttribute('data-theme', savedTheme);
    elements.themeToggle.checked = savedTheme === 'light';
}

function toggleTheme() {
    const newTheme = elements.themeToggle.checked ? 'light' : 'dark';
    elements.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// --- CSV Export ---
function exportToCSV() {
    if (!window.lastCalculatedResults || window.lastCalculatedResults.length === 0) {
        elements.timeErrorSpan.textContent = "Please calculate splits first.";
        return;
    }
    let csvContent = "Point on Route,Dist (km),Total Dist (km),Time to Point,Time of Day,Split Time,Speed on Split (km/h),Moving Average Speed (km/h)\n";
    window.lastCalculatedResults.forEach(row => {
        csvContent += `"${row.name}",${row.dist},${row.totalDist},${row.timeToPoint},${row.timeOfDay},${row.splitTime},${row.speedOnSplit},${row.movingAvgSpeed}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Amashova_Splits_${elements.targetHrInput.value}h${elements.targetMinInput.value}m.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Event Listeners Setup ---
function addEventListeners() {
    // Inputs that trigger recalculation
    const liveInputs = [
        elements.targetHrInput, elements.targetMinInput,
        elements.targetHrSlider, elements.targetMinSlider,
        elements.startHrInput, elements.startMinInput,
        elements.pacingStrategyInput
    ];
    liveInputs.forEach(input => input.addEventListener('input', () => {
        updateSummary();
        calculateSplits();
    }));

    // Sync sliders and number inputs
    elements.targetHrInput.addEventListener('input', () => syncInputs(elements.targetHrInput, elements.targetHrSlider));
    elements.targetHrSlider.addEventListener('input', () => syncInputs(elements.targetHrSlider, elements.targetHrInput));
    elements.targetMinInput.addEventListener('input', () => syncInputs(elements.targetMinInput, elements.targetMinSlider));
    elements.targetMinSlider.addEventListener('input', () => syncInputs(elements.targetMinSlider, elements.targetMinInput));

    // Button clicks
    elements.calculateButton.addEventListener('click', calculateSplits);
    elements.exportButton.addEventListener('click', exportToCSV);

    // Theming
    elements.themeToggle.addEventListener('change', toggleTheme);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setInitialTheme();
    addEventListeners();
    updateSummary();
    calculateSplits(); // Initial calculation on page load
});
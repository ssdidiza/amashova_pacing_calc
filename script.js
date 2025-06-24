// Define the race segments and their base distances
// Segment data includes: Point on Route, Distance (Dist), Total Distance (TotalDist)
// The timeFactor is derived from the provided examples and represents the relative difficulty/speed of each segment.
// A factor > 1 means the segment is relatively slower than the overall average speed.
// A factor < 1 means the segment is relatively faster than the overall average speed.
// These factors have been normalized so their sum equals the number of segments (6),
// ensuring the total time calculation is exact.
const segments = [
    { name: "Water Table 1 Thornville Chicken Farm", dist: 24.5, totalDist: 24.5, timeFactor: 1.1577 },
    { name: "Water Table 2 Cato Ridge", dist: 17.3, totalDist: 41.8, timeFactor: 1.0815 },
    { name: "Water Table 3 Comrades Wall of Fame", dist: 13.5, totalDist: 55.3, timeFactor: 1.0915 },
    { name: "Gilletts Station", dist: 19.2, totalDist: 74.5, timeFactor: 0.9512 },
    { name: "Forty-fifth Cutting", dist: 19.2, totalDist: 93.7, timeFactor: 0.7948 },
    { name: "Finish at Suncoast", dist: 12.3, totalDist: 106.0, timeFactor: 0.8830 }
];

const totalRaceDistance = 106.0; // km

/**
 * Formats time in hours (decimal) to HH:MM:SS string.
 * @param {number} timeInHours - Time in hours as a decimal.
 * @returns {string} Formatted time string (HH:MM:SS).
 */
function formatTime(timeInHours) {
    const totalSeconds = Math.round(timeInHours * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calculates and displays the split times and speeds based on target finish time.
 */
function calculateSplits() {
    const targetHrInput = document.getElementById('targetHr');
    const targetMinInput = document.getElementById('targetMin');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const avgSpeedSpan = document.getElementById('avgSpeed');

    const targetHr = parseInt(targetHrInput.value);
    const targetMin = parseInt(targetMinInput.value);

    // Input validation
    if (isNaN(targetHr) || isNaN(targetMin) || targetHr < 0 || targetMin < 0 || targetMin > 59) {
        alert("Please enter valid positive numbers for hours and minutes (minutes must be 0-59).");
        return;
    }

    const targetTimeInHours = targetHr + (targetMin / 60);

    if (targetTimeInHours <= 0) {
        alert("Target time must be greater than zero.");
        return;
    }

    // Calculate overall average speed
    const overallAvgSpeed = totalRaceDistance / targetTimeInHours;
    avgSpeedSpan.textContent = overallAvgSpeed.toFixed(2);

    let cumulativeTimeInHours = 0;
    resultsTableBody.innerHTML = ''; // Clear previous results

    // Step 1: Calculate the "proportional time contribution" for each segment
    // This value represents the segment's effective distance when its difficulty factor is applied.
    // The sum of these proportional contributions will be used to correctly distribute the target time.
    const proportionalContributions = segments.map(segment => segment.dist * segment.timeFactor);
    const sumProportionalContributions = proportionalContributions.reduce((sum, val) => sum + val, 0);

    // Step 2: Calculate actual split times based on the target time and proportional contributions
    const calculatedResults = [];
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // Calculate the actual split time for this segment
        // The target time is distributed proportionally based on the segment's
        // weighted distance (dist * timeFactor) relative to the total weighted distance.
        const actualSplitTimeInHours = (proportionalContributions[i] / sumProportionalContributions) * targetTimeInHours;

        const speedOnSplit = segment.dist / actualSplitTimeInHours;
        cumulativeTimeInHours += actualSplitTimeInHours;
        const movingAvgSpeed = segment.totalDist / cumulativeTimeInHours;

        calculatedResults.push({
            name: segment.name,
            dist: segment.dist,
            totalDist: segment.totalDist,
            timeToPoint: formatTime(cumulativeTimeInHours),
            splitTime: formatTime(actualSplitTimeInHours),
            speedOnSplit: speedOnSplit.toFixed(2),
            movingAvgSpeed: movingAvgSpeed.toFixed(2),
            rawSplitTimeHours: actualSplitTimeInHours // Store for CSV export
        });

        const row = resultsTableBody.insertRow();
        row.insertCell().textContent = segment.name;
        row.insertCell().textContent = segment.dist.toFixed(1);
        row.insertCell().textContent = segment.totalDist.toFixed(1);
        row.insertCell().textContent = formatTime(cumulativeTimeInHours);
        row.insertCell().textContent = formatTime(actualSplitTimeInHours);
        row.insertCell().textContent = speedOnSplit.toFixed(2);
        row.insertCell().textContent = movingAvgSpeed.toFixed(2);
    }

    // Store calculated results globally for CSV export
    window.lastCalculatedResults = calculatedResults;
}

/**
 * Exports the current calculation results to a CSV file.
 */
function exportToCSV() {
    if (!window.lastCalculatedResults || window.lastCalculatedResults.length === 0) {
        alert("Please calculate the split times first.");
        return;
    }

    let csvContent = "Point on Route,Dist (km),Total Dist (km),Time to Point,Split Time,Speed on Split (km/h),Moving Average Speed (km/h)\n";

    window.lastCalculatedResults.forEach(row => {
        csvContent += `${row.name},${row.dist},${row.totalDist},${row.timeToPoint},${row.splitTime},${row.speedOnSplit},${row.movingAvgSpeed}\n`;
    });

    const targetHr = document.getElementById('targetHr').value;
    const targetMin = document.getElementById('targetMin').value;
    const filename = `Amashova_Splits_${targetHr}h${targetMin}m.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Feature detection for HTML5 download attribute
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else { // Fallback for older browsers
        alert("Your browser does not support the download attribute. Please copy the data manually.");
    }
}

// Initial calculation on page load with default values
document.addEventListener('DOMContentLoaded', calculateSplits);
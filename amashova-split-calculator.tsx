import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Zap, Target } from 'lucide-react';

const AmashovaSplitCalculator = () => {
  const [targetHours, setTargetHours] = useState(3);
  const [targetMinutes, setTargetMinutes] = useState(0);
  type Split = {
    name: string;
    distance: number;
    totalDistance: number;
    timeToPoint: string;
    splitTime: string;
    splitSpeed: string;
    movingAvgSpeed: string;
  };
  
  const [splits, setSplits] = useState<Split[]>([]);

  // Race route data based on the provided reference
  const routePoints = [
    { name: "Water Table 1 Thornville Chicken Farm", distance: 24.5, totalDistance: 24.5 },
    { name: "Water Table 2 Cato Ridge", distance: 17.3, totalDistance: 41.8 },
    { name: "Water Table 3 Comrades Wall of Fame", distance: 13.5, totalDistance: 55.3 },
    { name: "Gilletts Station", distance: 19.2, totalDistance: 74.5 },
    { name: "Forty-fifth Cutting", distance: 19.2, totalDistance: 93.7 },
    { name: "Finish at Suncoast", distance: 12.3, totalDistance: 106.0 }
  ];

  const calculateSplits = () => {
    const totalMinutes = targetHours * 60 + targetMinutes;
    const totalDistance = 106.0;
    
    // Difficulty factors based on terrain analysis from reference data
    // These factors account for hills, terrain difficulty, and section characteristics
    const difficultyFactors = [
      0.85,  // Thornville - easier start section
      1.05,  // Cato Ridge - slight uphill
      1.10,  // Comrades Wall of Fame - challenging section
      0.95,  // Gilletts Station - mixed terrain
      0.80,  // Forty-fifth Cutting - fast downhill section  
      0.90   // Finish at Suncoast - final push
    ];

    // Calculate base time allocation per km
    const totalDifficultyWeightedDistance = routePoints.reduce((sum, point, index) => 
      sum + (point.distance * difficultyFactors[index]), 0
    );
    
    const timePerWeightedKm = totalMinutes / totalDifficultyWeightedDistance;

    const calculatedSplits: Split[] = [];
    let cumulativeTime = 0;

    routePoints.forEach((point, index) => {
      // Calculate time for this segment based on difficulty
      const segmentTime = point.distance * difficultyFactors[index] * timePerWeightedKm;
      const timeToPoint = cumulativeTime + segmentTime;
      
      // Calculate speeds
      const splitSpeed = (point.distance / (segmentTime / 60)); // km/h for this segment
      const movingAvgSpeed = point.totalDistance / (timeToPoint / 60); // km/h average to this point
      
      // Format times
      const timeToPointFormatted = formatTime(timeToPoint);
      const splitTimeFormatted = formatTime(segmentTime);
      
      calculatedSplits.push({
        ...point,
        timeToPoint: timeToPointFormatted,
        splitTime: splitTimeFormatted,
        splitSpeed: splitSpeed.toFixed(2),
        movingAvgSpeed: movingAvgSpeed.toFixed(2)
      });
      
      cumulativeTime = timeToPoint;
    });

    setSplits(calculatedSplits);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    calculateSplits();
  }, [targetHours, targetMinutes]);

  const totalDistance = 106.0;
  const avgSpeed = totalDistance / (targetHours + targetMinutes / 60);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Amashova Durban Classic</h1>
          <h2 className="text-2xl text-blue-600 mb-4">Split Time Calculator</h2>
          <div className="flex items-center justify-center gap-2 text-gray-600 mb-3">
            <MapPin className="w-5 h-5" />
            <span>106km Cycling Race</span>
          </div>
          
          {/* WhatsApp Group Link */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700 mb-2">Join the Amashova community!</p>
            <a 
              href="https://chat.whatsapp.com/EUCChxKCvF2BfEMDp7q5p2" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
              Join WhatsApp Group
            </a>
          </div>
        </div>

        {/* Target Time Input */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 mb-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6" />
            <h3 className="text-xl font-semibold">Target Time</h3>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Hours:</label>
              <input
                type="number"
                min="1"
                max="12"
                value={targetHours}
                onChange={(e) => setTargetHours(parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 rounded-lg text-gray-800 font-semibold text-center"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Minutes:</label>
              <input
                type="number"
                min="0"
                max="59"
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 0)}
                className="w-20 px-3 py-2 rounded-lg text-gray-800 font-semibold text-center"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Total Time: {targetHours}:{targetMinutes.toString().padStart(2, '0')}:00</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Average Speed: {avgSpeed.toFixed(1)} km/h</span>
            </div>
          </div>
        </div>

        {/* Split Times Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-lg">
            <thead>
              <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white">
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">Point on Route</th>
                <th className="px-4 py-3 text-center font-semibold">Dist</th>
                <th className="px-4 py-3 text-center font-semibold">Total Dist</th>
                <th className="px-4 py-3 text-center font-semibold">Time to Point</th>
                <th className="px-4 py-3 text-center font-semibold">Split Time</th>
                <th className="px-4 py-3 text-center font-semibold">Speed on Split</th>
                <th className="px-4 py-3 text-center font-semibold">Moving Avg Speed</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((split, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                    index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-blue-600">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{split.name}</td>
                  <td className="px-4 py-3 text-center font-mono">{split.distance}</td>
                  <td className="px-4 py-3 text-center font-mono font-semibold">{split.totalDistance}</td>
                  <td className="px-4 py-3 text-center font-mono text-blue-600 font-semibold">{split.timeToPoint}</td>
                  <td className="px-4 py-3 text-center font-mono text-green-600 font-semibold">{split.splitTime}</td>
                  <td className="px-4 py-3 text-center font-mono">{split.splitSpeed}</td>
                  <td className="px-4 py-3 text-center font-mono text-purple-600 font-semibold">{split.movingAvgSpeed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p className="mb-2">
            Created by{' '}
            <a 
              href="https://www.strava.com/athletes/26187606" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Spera Didiza
            </a>
          </p>
          <p>Split Time Calculator - Amashova Durban Classic Cycling Race</p>
          <p className="mt-1">Adjust your target time above to see predicted splits and pacing strategy</p>
          <p className="text-xs mt-2 text-gray-400">* Times calculated based on terrain difficulty and section characteristics</p>
        </div>
      </div>
    </div>
  );
};

export default AmashovaSplitCalculator;
'use strict';

// Amashova Durban Classic — hand-tuned configuration.
// Calculation inputs intentionally retained from the previous live version.
window.RACES = window.RACES || {};
window.RACES['amashova-106'] = {
    id: 'amashova-106',
    name: 'Amashova Durban Classic',
    shortName: 'AMASHOVA 106',
    edition: 'October 2026',
    distanceKm: 106.0,
    startLocation: 'Pietermaritzburg',
    finishLocation: 'Suncoast, Durban',
    heroCopy: 'Build a clear 106 km pacing plan with target checkpoint arrival times and segment speed guidance.',
    notice: '',
    climbGain: null,
    checkpoints: [
        { name: 'WT1 Thornville', shortName: 'Thornville', dist: 24.5, totalDist: 24.5, note: 'Rolling start on the drags out of PMB. Settle in, do not surge.' },
        { name: 'WT2 Cato Ridge', shortName: 'Cato Ridge', dist: 17.3, totalDist: 41.8, note: 'Steady rolling terrain. Fuel and drink early, before you need it.' },
        { name: 'WT3 Wall of Fame', shortName: 'Wall of Fame', dist: 13.5, totalDist: 55.3, note: 'Inchanga sits in this stretch. Hold your own pace on the climb.' },
        { name: 'Gilletts Station', shortName: 'Gilletts', dist: 19.2, totalDist: 74.5, note: 'Botha’s Hill then fast descending. Stay alert in the bunch.' },
        { name: '45th Cutting', shortName: '45th Cutting', dist: 19.2, totalDist: 93.7, note: 'Long downhill run towards town. Recover, but keep eating.' },
        { name: 'Finish Suncoast', shortName: 'Finish', dist: 12.3, totalDist: 106.0, note: 'Flat run-in along the beachfront. Empty the tank safely.' }
    ],
    climbs: [
        { name: 'Ashburton drag', km: 10 },
        { name: 'Inchanga', km: 46 },
        { name: 'Botha’s Hill', km: 58 },
        { name: '45th Cutting', km: 92 }
    ],
    elevation: [
        { km: 0, ele: 650 }, { km: 5, ele: 690 }, { km: 10, ele: 760 }, { km: 15, ele: 780 },
        { km: 20, ele: 730 }, { km: 24.5, ele: 710 }, { km: 30, ele: 690 }, { km: 35, ele: 660 },
        { km: 41.8, ele: 720 }, { km: 46, ele: 770 }, { km: 50, ele: 700 }, { km: 55.3, ele: 620 },
        { km: 58, ele: 720 }, { km: 62, ele: 680 }, { km: 66, ele: 620 }, { km: 70, ele: 580 },
        { km: 74.5, ele: 520 }, { km: 80, ele: 420 }, { km: 85, ele: 330 }, { km: 90, ele: 180 },
        { km: 93.7, ele: 110 }, { km: 98, ele: 40 }, { km: 102, ele: 15 }, { km: 106, ele: 5 }
    ],
    elevationNote: 'Indicative profile — confirm against official route data before race day.',
    strategies: {
        even: [1.1577, 1.0815, 1.0915, 0.9512, 0.7948, 0.8830],
        conservative: [1.25, 1.10, 1.09, 0.94, 0.78, 0.80],
        aggressive: [1.05, 1.06, 1.10, 0.96, 0.81, 0.98]
    }
};

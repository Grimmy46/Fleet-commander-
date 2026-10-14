// ═══════════════════════════════════════════════════════════════
//  SHIP TYPES — physical specs, copied exactly from 0.14 js/ship.js
//  (DDG_SPEC). Task #8 moves these into validated data files.
// ═══════════════════════════════════════════════════════════════
export const SHIP_TYPES = {
  ddg: {
    id: 'ddg',
    class: 'ARLEIGH BURKE',
    flight: 'FLIGHT IIA',
    lengthM: 155.3,
    beamM: 20.1,
    draftM: 9.4,
    displacementT: 9217,

    maxSpeedKts: 31,
    minSpeedKts: -5,        // astern
    accelRate: 0.28,        // knots per second
    decelRate: 0.42,        // knots per second
    maxRudderDeg: 35,
    rudderRate: 3.5,        // degrees per second
    turnRateFactor: 0.95,
    fullSteerageKts: 15,    // below this, turning weakens; 0 kts = no steerage
    autoHelmGain: 1.8,      // rudder degrees per degree of heading error

    radarHeightM: 20
  }
};

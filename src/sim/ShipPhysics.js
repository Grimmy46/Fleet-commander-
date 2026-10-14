// ═══════════════════════════════════════════════════════════════
//  SHIP PHYSICS — one ship, one fixed step. Pure function of
//  (state, spec, dt): no rendering, no globals, no randomness.
//
//  This is a line-for-line port of 0.14 Ship.update() (js/ship.js)
//  minus the wake trail, which is a visual effect and now belongs
//  to the renderer. tests/sim.test.mjs runs both side by side and
//  requires them to agree.
// ═══════════════════════════════════════════════════════════════
import { SEC_PER_HOUR, DEG, wrap360, angleDiff, clamp } from './units.js';

/** Fresh physics state for a ship. Plain data, safe to save as JSON. */
export function createShipState({ x = 0, y = 0, hdg = 0, speed = 0 } = {}) {
  return {
    x, y,                 // nm (x east, y south)
    hdg: wrap360(hdg),    // degrees true
    speed,                // knots
    ordSpeed: speed,      // ordered speed, knots
    rudder: 0,            // current rudder, degrees (+ = starboard)
    ordRudder: 0,         // ordered rudder
    ordHdg: wrap360(hdg), // ordered heading
    autoHelm: true        // true: steer to ordHdg; false: hold ordRudder
  };
}

// ── Orders ────────────────────────────────────────────────────
export function orderSpeed(s, spec, kts) {
  s.ordSpeed = clamp(kts, spec.minSpeedKts, spec.maxSpeedKts);
}
export function orderHeading(s, spec, deg) {
  s.ordHdg = wrap360(deg);
  s.autoHelm = true;
}
export function orderRudder(s, spec, deg) {
  s.ordRudder = clamp(deg, -spec.maxRudderDeg, spec.maxRudderDeg);
  s.autoHelm = false;
}

// ── Step ──────────────────────────────────────────────────────
export function stepShip(s, spec, dt) {
  // Throttle: gas turbines spool at a fixed rate
  if (s.speed < s.ordSpeed) s.speed = Math.min(s.ordSpeed, s.speed + spec.accelRate * dt);
  else if (s.speed > s.ordSpeed) s.speed = Math.max(s.ordSpeed, s.speed - spec.decelRate * dt);

  // Auto-helm: proportional rudder toward the ordered heading
  if (s.autoHelm) {
    const err = angleDiff(s.hdg, s.ordHdg);
    s.ordRudder = clamp(err * spec.autoHelmGain, -spec.maxRudderDeg, spec.maxRudderDeg);
  }

  // Rudder slews at a finite rate
  if (s.rudder < s.ordRudder) s.rudder = Math.min(s.ordRudder, s.rudder + spec.rudderRate * dt);
  else if (s.rudder > s.ordRudder) s.rudder = Math.max(s.ordRudder, s.rudder - spec.rudderRate * dt);

  // Turn rate depends on rudder AND speed: no steerage at rest
  const speedFactor = Math.min(1, Math.abs(s.speed) / spec.fullSteerageKts);
  const turnRate = s.rudder * spec.turnRateFactor * speedFactor * 0.045;   // deg/s
  s.hdg = wrap360(s.hdg + turnRate * dt);

  // Move: knots are nm per hour
  const nmPerSec = s.speed / SEC_PER_HOUR;
  s.x += Math.sin(s.hdg * DEG) * nmPerSec * dt;
  s.y -= Math.cos(s.hdg * DEG) * nmPerSec * dt;
}

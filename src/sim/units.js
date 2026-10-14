// ═══════════════════════════════════════════════════════════════
//  UNITS — the simulation works in nautical miles, knots, seconds
//  and degrees true, like the 0.14 game.
//
//  Sim coordinates: x = nm east, y = nm SOUTH (screen-style, kept
//  from 0.14 so its data and scenarios port unchanged).
//  Heading 0 = north, 90 = east.
// ═══════════════════════════════════════════════════════════════
export const M_PER_NM = 1852;
export const SEC_PER_HOUR = 3600;
export const DEG = Math.PI / 180;

/** Wrap an angle into [0, 360). */
export function wrap360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Signed shortest difference b - a, in (-180, 180]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

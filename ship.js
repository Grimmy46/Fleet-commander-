// ═══════════════════════════════════════════════════════════════
//  SHIP — Arleigh Burke Flight IIA (DDG-79 class)
//  Real specifications and physics.
// ═══════════════════════════════════════════════════════════════

const DDG_SPEC = {
  class: 'ARLEIGH BURKE',
  flight: 'FLIGHT IIA',
  hull: 'DDG-144',
  name: 'DDG-144',
  operator: 'SPEARPOINT GLOBAL SOLUTIONS',

  // Physical — real numbers
  lengthM: 155.3,        // 509' 6"
  beamM: 20.1,           // 66'
  draftM: 9.4,           // 31'
  displacementT: 9217,   // full load, long tons

  // Propulsion — 4x LM2500-30 gas turbines, 105,000 shp
  maxSpeedKts: 31,
  cruiseSpeedKts: 20,
  economicalKts: 14,
  // Acceleration in kts per second (gas turbines spool fast)
  accelRate: 0.28,
  decelRate: 0.42,
  // Turning: tactical diameter ~700 yards at 20kts
  maxRudderDeg: 35,
  rudderRate: 3.5,       // degrees per second
  turnRateFactor: 0.95,  // deg/s per (rudder_deg * speed_factor)

  // Sensors
  radarHeightM: 20,      // SPY-1D array height above waterline
  radarName: 'AN/SPY-1D(V)',
  radarMaxNm: 200,       // instrumented range (air); surface limited by horizon

  crew: 329,
  co: 'MITCHELL'
};

// ── WEAPON MAGAZINE — realistic Flight IIA loadout ────────────
// 96 Mk 41 VLS cells: 32 forward + 64 aft
const MAGAZINE = {
  vlsTotal: 96,
  vlsForward: 32,
  vlsAft: 64,

  weapons: {
    sm2: {
      name: 'RIM-66 SM-2MR Block IIIB',
      short: 'SM-2',
      role: 'Anti-Air',
      cells: 40, perCell: 1, count: 40,
      rangeNm: 90, speedMach: 3.5,
      col: '#5ac8fa'
    },
    sm6: {
      name: 'RIM-174 SM-6 Dual I',
      short: 'SM-6',
      role: 'Anti-Air / Anti-Surface',
      cells: 8, perCell: 1, count: 8,
      rangeNm: 130, speedMach: 3.5,
      col: '#64d2ff'
    },
    essm: {
      name: 'RIM-162 ESSM Block II',
      short: 'ESSM',
      role: 'Point Defense',
      cells: 8, perCell: 4, count: 32,   // quad-packed
      rangeNm: 27, speedMach: 4.0,
      col: '#30d158'
    },
    tomahawk: {
      name: 'BGM-109 Tomahawk Block V',
      short: 'TLAM',
      role: 'Land Attack',
      cells: 24, perCell: 1, count: 24,
      rangeNm: 900, speedMach: 0.74,
      col: '#ff9f0a'
    },
    asroc: {
      name: 'RUM-139 VL-ASROC',
      short: 'ASROC',
      role: 'Anti-Submarine',
      cells: 8, perCell: 1, count: 8,
      rangeNm: 12, speedMach: 1.0,
      col: '#bf5af2'
    }
  },

  // Gun — Mk 45 Mod 4 5"/62 caliber
  gun: {
    name: 'Mk 45 Mod 4  5"/62',
    short: '5in GUN',
    role: 'Naval Gunfire',
    rounds: 600,
    maxRounds: 600,
    rangeNm: 13,          // ~24km with standard round
    rateOfFire: 20,       // rounds per minute
    col: '#ffd60a'
  },

  // Close-in weapon system
  ciws: {
    name: 'Mk 15 Phalanx Block 1B',
    short: 'CIWS',
    role: 'Last-Ditch Defense',
    rounds: 1550,
    maxRounds: 1550,
    rangeNm: 1.0,
    rateOfFire: 4500,
    col: '#ff453a'
  },

  // Torpedoes — Mk 32 triple tubes, port and starboard
  torpedo: {
    name: 'Mk 54 Lightweight Torpedo',
    short: 'Mk 54',
    role: 'Anti-Submarine',
    count: 6, maxCount: 6,
    rangeNm: 5,
    col: '#0a84ff'
  },

  // Aviation — Flight IIA has twin hangar
  helos: {
    name: 'MH-60R Seahawk',
    short: 'SEAHAWK',
    count: 2, maxCount: 2,
    radarNm: 80,          // APS-153 surface search
    enduranceMin: 180,
    col: '#98989d'
  }
};

// Deep-copy magazine for a fresh loadout
function freshMagazine() {
  return JSON.parse(JSON.stringify(MAGAZINE));
}

// ── SHIP CLASS ────────────────────────────────────────────────
class Ship {
  constructor(x, y, hdg, faction, type) {
    this.x = x; this.y = y;              // position in nm
    this.hdg = hdg;                       // heading in degrees true
    this.faction = faction;               // 'friendly' | 'hostile' | 'neutral' | 'unknown'
    this.type = type || 'ddg';

    this.speed = 0;                       // current speed, knots
    this.ordSpeed = 0;                    // ordered speed
    this.rudder = 0;                      // current rudder angle
    this.ordRudder = 0;
    this.ordHdg = hdg;                    // ordered heading
    this.autoHelm = true;                 // steer to ordered heading

    this.spec = DDG_SPEC;
    this.mag = freshMagazine();
    this.wake = [];
    this.id = Ship._id = (Ship._id || 0) + 1;
  }

  get maxSpeed() { return this.spec.maxSpeedKts; }

  // Radar horizon in nm against a target of given mast height (m)
  radarHorizonNm(targetHeightM = 10) {
    return 2.23 * (Math.sqrt(this.spec.radarHeightM) + Math.sqrt(targetHeightM));
  }

  orderSpeed(kts) {
    this.ordSpeed = Math.max(-5, Math.min(this.maxSpeed, kts));
  }

  orderHeading(deg) {
    this.ordHdg = ((deg % 360) + 360) % 360;
    this.autoHelm = true;
  }

  orderRudder(deg) {
    this.ordRudder = Math.max(-this.spec.maxRudderDeg, Math.min(this.spec.maxRudderDeg, deg));
    this.autoHelm = false;
  }

  // dt in seconds (already time-scaled)
  update(dt) {
    const S = this.spec;

    // Throttle
    if (this.speed < this.ordSpeed) {
      this.speed = Math.min(this.ordSpeed, this.speed + S.accelRate * dt);
    } else if (this.speed > this.ordSpeed) {
      this.speed = Math.max(this.ordSpeed, this.speed - S.decelRate * dt);
    }

    // Auto-helm: compute rudder needed to reach ordered heading
    if (this.autoHelm) {
      let err = this.ordHdg - this.hdg;
      while (err > 180) err -= 360;
      while (err < -180) err += 360;
      // Proportional with damping
      const want = Math.max(-S.maxRudderDeg, Math.min(S.maxRudderDeg, err * 1.8));
      this.ordRudder = want;
    }

    // Rudder slews at finite rate
    if (this.rudder < this.ordRudder) {
      this.rudder = Math.min(this.ordRudder, this.rudder + S.rudderRate * dt);
    } else if (this.rudder > this.ordRudder) {
      this.rudder = Math.max(this.ordRudder, this.rudder - S.rudderRate * dt);
    }

    // Turn rate depends on rudder AND speed (no steerage at rest)
    const speedFactor = Math.min(1, Math.abs(this.speed) / 15);
    const turnRate = this.rudder * S.turnRateFactor * speedFactor * 0.045;
    this.hdg = ((this.hdg + turnRate * dt) % 360 + 360) % 360;

    // Move — speed in knots = nm per hour, dt is seconds
    const nmPerSec = this.speed / 3600;
    const rad = this.hdg * Math.PI / 180;
    this.x += Math.sin(rad) * nmPerSec * dt;
    this.y -= Math.cos(rad) * nmPerSec * dt;

    // Wake trail
    this._wakeAcc = (this._wakeAcc || 0) + dt;
    if (this.speed > 2 && this._wakeAcc > 1.2) {
      this._wakeAcc = 0;
      this.wake.push({ x: this.x, y: this.y, age: 0, spd: this.speed });
    }
    for (let i = this.wake.length - 1; i >= 0; i--) {
      this.wake[i].age += dt;
      if (this.wake[i].age > 240) this.wake.splice(i, 1);
    }
  }

  // Turning circle advance/transfer estimate for display
  tacticalDiameterNm() {
    return 0.38 * (1 + this.speed / 60);
  }
}

// ── SHIP RENDERING (multi-LOD) ────────────────────────────────
// pxPerNm determines detail level.
//   < 55        NATO tactical symbol
//   55 - 380    simplified hull shape
//   > 380       full detailed model

const LOD_SYMBOL = 55;
const LOD_DETAIL = 380;

function drawShip(ctx, ship, sx, sy, pxPerNm, opts = {}) {
  const lengthNm = ship.spec ? ship.spec.lengthM / 1852 : 0.08;
  const lengthPx = lengthNm * pxPerNm;

  if (pxPerNm < LOD_SYMBOL) {
    drawNatoSymbol(ctx, ship, sx, sy, opts);
  } else if (pxPerNm < LOD_DETAIL) {
    drawSimpleHull(ctx, ship, sx, sy, lengthPx, opts);
  } else {
    drawDetailedDDG(ctx, ship, sx, sy, lengthPx, opts);
  }
}

// ── LOD 1: NATO tactical symbol ───────────────────────────────
function drawNatoSymbol(ctx, ship, sx, sy, opts) {
  const col = factionColor(ship.faction);
  const R = 9;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.8;

  if (ship.faction === 'friendly') {
    // Friendly surface: semicircle (open bottom)
    ctx.beginPath();
    ctx.arc(sx, sy, R, Math.PI, 0);
    ctx.moveTo(sx - R, sy); ctx.lineTo(sx + R, sy);
    ctx.stroke();
  } else if (ship.faction === 'hostile') {
    // Hostile: diamond
    ctx.beginPath();
    ctx.moveTo(sx, sy - R); ctx.lineTo(sx + R, sy);
    ctx.lineTo(sx, sy + R); ctx.lineTo(sx - R, sy);
    ctx.closePath(); ctx.stroke();
  } else if (ship.faction === 'neutral') {
    // Neutral: square
    ctx.strokeRect(sx - R * 0.85, sy - R * 0.85, R * 1.7, R * 1.7);
  } else {
    // Unknown: quatrefoil approximation (rounded square)
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', sx, sy + 4);
  }

  // Velocity leader — length proportional to speed
  if (ship.speed > 0.5) {
    const rad = ship.hdg * Math.PI / 180;
    const len = 8 + ship.speed * 0.8;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.sin(rad) * len, sy - Math.cos(rad) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// ── LOD 2: simplified hull ────────────────────────────────────
function drawSimpleHull(ctx, ship, sx, sy, L, opts) {
  const col = factionColor(ship.faction);
  const B = L * 0.13; // beam-to-length ratio
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ship.hdg * Math.PI / 180);

  // Recognisable silhouette if we have one for this type
  if (typeof drawVehicle === 'function' && L > 9) {
    if (drawVehicle(ctx, ship.type, L, col, { speed: ship.speed })) {
      ctx.restore();
      return;
    }
  }

  ctx.fillStyle = shade(col, -55);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.5);
  ctx.lineTo(B * 0.55, -L * 0.34);
  ctx.lineTo(B * 0.62, -L * 0.05);
  ctx.lineTo(B * 0.58, L * 0.32);
  ctx.lineTo(B * 0.40, L * 0.48);
  ctx.lineTo(-B * 0.40, L * 0.48);
  ctx.lineTo(-B * 0.58, L * 0.32);
  ctx.lineTo(-B * 0.62, -L * 0.05);
  ctx.lineTo(-B * 0.55, -L * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Superstructure hint
  ctx.fillStyle = shade(col, -25);
  ctx.fillRect(-B * 0.35, -L * 0.12, B * 0.70, L * 0.30);
  ctx.restore();
}

// ── LOD 3: full Flight IIA detail ─────────────────────────────
// Coordinates normalized to hull length L, bow at -0.5L
function drawDetailedDDG(ctx, ship, sx, sy, L, opts) {
  const B = L * 0.1294;           // 20.1m / 155.3m
  const hull = '#5c6b73';
  const deck = '#4a5a63';
  const supr = '#6b7a85';
  const dark = '#374850';
  const light = '#8a99a3';

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ship.hdg * Math.PI / 180);
  const s = L; // scale reference

  // ── HULL ──
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -0.500 * s);                 // bow
  ctx.quadraticCurveTo(0.030 * s, -0.455 * s, 0.042 * s, -0.400 * s);
  ctx.lineTo(0.050 * s, -0.300 * s);
  ctx.lineTo(0.0647 * s, -0.150 * s);        // max beam
  ctx.lineTo(0.0647 * s, 0.180 * s);
  ctx.lineTo(0.060 * s, 0.330 * s);
  ctx.lineTo(0.052 * s, 0.440 * s);
  ctx.lineTo(0.044 * s, 0.500 * s);          // transom
  ctx.lineTo(-0.044 * s, 0.500 * s);
  ctx.lineTo(-0.052 * s, 0.440 * s);
  ctx.lineTo(-0.060 * s, 0.330 * s);
  ctx.lineTo(-0.0647 * s, 0.180 * s);
  ctx.lineTo(-0.0647 * s, -0.150 * s);
  ctx.lineTo(-0.050 * s, -0.300 * s);
  ctx.lineTo(-0.042 * s, -0.400 * s);
  ctx.quadraticCurveTo(-0.030 * s, -0.455 * s, 0, -0.500 * s);
  ctx.closePath();
  ctx.fill();

  // Hull shading — port side darker
  ctx.save();
  ctx.clip();
  const grad = ctx.createLinearGradient(-0.065 * s, 0, 0.065 * s, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.28)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(-0.07 * s, -0.51 * s, 0.14 * s, 1.02 * s);
  ctx.restore();

  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(0.5, s * 0.0018);
  ctx.stroke();

  // ── FORECASTLE DECK ──
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.moveTo(0, -0.474 * s);
  ctx.lineTo(0.036 * s, -0.400 * s);
  ctx.lineTo(0.044 * s, -0.300 * s);
  ctx.lineTo(0.056 * s, -0.160 * s);
  ctx.lineTo(0.056 * s, -0.090 * s);
  ctx.lineTo(-0.056 * s, -0.090 * s);
  ctx.lineTo(-0.056 * s, -0.160 * s);
  ctx.lineTo(-0.044 * s, -0.300 * s);
  ctx.lineTo(-0.036 * s, -0.400 * s);
  ctx.closePath();
  ctx.fill();

  // Anchor hawse pipes
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(0.030 * s, -0.406 * s, 0.006 * s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-0.030 * s, -0.406 * s, 0.006 * s, 0, 7); ctx.fill();
  // Breakwater
  ctx.strokeStyle = light; ctx.lineWidth = Math.max(0.4, s * 0.0015);
  ctx.beginPath();
  ctx.moveTo(-0.040 * s, -0.352 * s);
  ctx.lineTo(0, -0.372 * s);
  ctx.lineTo(0.040 * s, -0.352 * s);
  ctx.stroke();

  // ── Mk 45 5"/62 GUN MOUNT ──
  const gx = 0, gy = -0.318 * s;
  ctx.fillStyle = supr;
  ctx.beginPath();
  // Angular stealth-faceted shield (Mod 4)
  ctx.moveTo(gx, gy - 0.040 * s);
  ctx.lineTo(gx + 0.020 * s, gy - 0.022 * s);
  ctx.lineTo(gx + 0.023 * s, gy + 0.020 * s);
  ctx.lineTo(gx - 0.023 * s, gy + 0.020 * s);
  ctx.lineTo(gx - 0.020 * s, gy - 0.022 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.4, s * 0.0014); ctx.stroke();
  // Barrel
  ctx.fillStyle = dark;
  ctx.fillRect(gx - 0.0055 * s, gy - 0.115 * s, 0.011 * s, 0.078 * s);
  ctx.fillStyle = '#222c32';
  ctx.fillRect(gx - 0.0038 * s, gy - 0.118 * s, 0.0076 * s, 0.012 * s);

  // ── FORWARD VLS — 32 cells (4 x 8) ──
  drawVLS(ctx, s, 0, -0.208 * s, 4, 8, 0.096, 0.088, deck, dark, light);

  // ── MAIN SUPERSTRUCTURE ──
  ctx.fillStyle = supr;
  ctx.beginPath();
  ctx.moveTo(-0.050 * s, -0.128 * s);
  ctx.lineTo(0.050 * s, -0.128 * s);
  ctx.lineTo(0.058 * s, -0.060 * s);
  ctx.lineTo(0.058 * s, 0.120 * s);
  ctx.lineTo(-0.058 * s, 0.120 * s);
  ctx.lineTo(-0.058 * s, -0.060 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.4, s * 0.0014); ctx.stroke();

  // Bridge — angled front face
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(-0.040 * s, -0.120 * s);
  ctx.lineTo(0.040 * s, -0.120 * s);
  ctx.lineTo(0.046 * s, -0.072 * s);
  ctx.lineTo(-0.046 * s, -0.072 * s);
  ctx.closePath();
  ctx.fill();
  // Bridge windows
  ctx.fillStyle = 'rgba(20,45,70,0.85)';
  for (let i = -3; i <= 3; i++) {
    ctx.fillRect(i * 0.0105 * s - 0.0035 * s, -0.116 * s, 0.007 * s, 0.010 * s);
  }
  // Bridge wings
  ctx.fillStyle = supr;
  ctx.fillRect(-0.072 * s, -0.108 * s, 0.024 * s, 0.014 * s);
  ctx.fillRect(0.048 * s, -0.108 * s, 0.024 * s, 0.014 * s);

  // ── SPY-1D RADAR ARRAYS — four octagonal faces ──
  const spyFaces = [
    { x: -0.042, y: -0.062, rot: -0.32 },
    { x:  0.042, y: -0.062, rot:  0.32 },
    { x: -0.048, y:  0.020, rot: -2.82 },
    { x:  0.048, y:  0.020, rot:  2.82 }
  ];
  for (const f of spyFaces) {
    ctx.save();
    ctx.translate(f.x * s, f.y * s);
    ctx.rotate(f.rot);
    const w = 0.030 * s, h = 0.030 * s;
    ctx.fillStyle = '#2e3d47';
    ctx.beginPath();
    const c = w * 0.28;
    ctx.moveTo(-w/2 + c, -h/2); ctx.lineTo(w/2 - c, -h/2);
    ctx.lineTo(w/2, -h/2 + c); ctx.lineTo(w/2, h/2 - c);
    ctx.lineTo(w/2 - c, h/2); ctx.lineTo(-w/2 + c, h/2);
    ctx.lineTo(-w/2, h/2 - c); ctx.lineTo(-w/2, -h/2 + c);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8fa3b0'; ctx.lineWidth = Math.max(0.4, s * 0.0013);
    ctx.stroke();
    // Array face texture
    ctx.strokeStyle = 'rgba(140,170,190,0.28)';
    ctx.lineWidth = Math.max(0.25, s * 0.0006);
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-w/2 + i*w/4, -h/2 + c*0.5);
      ctx.lineTo(-w/2 + i*w/4, h/2 - c*0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── FORWARD MAST ──
  ctx.fillStyle = dark;
  ctx.fillRect(-0.008 * s, -0.040 * s, 0.016 * s, 0.048 * s);
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(0.35, s * 0.0011);
  // Yardarms
  ctx.beginPath();
  ctx.moveTo(-0.040 * s, -0.028 * s); ctx.lineTo(0.040 * s, -0.028 * s);
  ctx.moveTo(-0.030 * s, -0.014 * s); ctx.lineTo(0.030 * s, -0.014 * s);
  ctx.stroke();
  // SPS-67 surface search radar (rotating bar)
  const rot = (Date.now() / 900) % (Math.PI * 2);
  ctx.save();
  ctx.translate(0, -0.030 * s);
  ctx.rotate(rot);
  ctx.strokeStyle = '#a8bcc8'; ctx.lineWidth = Math.max(0.5, s * 0.0016);
  ctx.beginPath(); ctx.moveTo(-0.019 * s, 0); ctx.lineTo(0.019 * s, 0); ctx.stroke();
  ctx.restore();

  // ── FUNNELS (two, offset) ──
  ctx.fillStyle = '#3f4e57';
  ctx.fillRect(-0.026 * s, 0.008 * s, 0.021 * s, 0.036 * s);
  ctx.fillRect(0.005 * s, 0.042 * s, 0.021 * s, 0.036 * s);
  ctx.fillStyle = '#2a353c';
  ctx.fillRect(-0.026 * s, 0.008 * s, 0.021 * s, 0.010 * s);
  ctx.fillRect(0.005 * s, 0.042 * s, 0.021 * s, 0.010 * s);
  // Exhaust staining
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-0.026 * s, 0.008 * s, 0.021 * s, 0.004 * s);
  ctx.fillRect(0.005 * s, 0.042 * s, 0.021 * s, 0.004 * s);

  // ── Mk 32 TORPEDO TUBES (triple, both sides) ──
  ctx.fillStyle = '#46555e';
  ctx.save();
  ctx.translate(-0.062 * s, 0.052 * s); ctx.rotate(-0.42);
  for (let i = 0; i < 3; i++) ctx.fillRect(-0.014 * s, -0.004 * s + i * 0.0042 * s, 0.028 * s, 0.0034 * s);
  ctx.restore();
  ctx.save();
  ctx.translate(0.062 * s, 0.052 * s); ctx.rotate(0.42);
  for (let i = 0; i < 3; i++) ctx.fillRect(-0.014 * s, -0.004 * s + i * 0.0042 * s, 0.028 * s, 0.0034 * s);
  ctx.restore();

  // ── AFT VLS — 64 cells (8 x 8) ──
  drawVLS(ctx, s, 0, 0.176 * s, 8, 8, 0.104, 0.104, deck, dark, light);

  // ── TWIN HELICOPTER HANGAR (Flight IIA signature) ──
  ctx.fillStyle = supr;
  ctx.fillRect(-0.052 * s, 0.124 * s, 0.104 * s, 0.104 * s);
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.4, s * 0.0013);
  ctx.strokeRect(-0.052 * s, 0.124 * s, 0.104 * s, 0.104 * s);
  // Two hangar doors
  ctx.fillStyle = '#3b4a53';
  ctx.fillRect(-0.046 * s, 0.196 * s, 0.042 * s, 0.030 * s);
  ctx.fillRect(0.004 * s, 0.196 * s, 0.042 * s, 0.030 * s);
  ctx.strokeStyle = 'rgba(180,200,215,0.35)';
  ctx.lineWidth = Math.max(0.3, s * 0.0009);
  ctx.strokeRect(-0.046 * s, 0.196 * s, 0.042 * s, 0.030 * s);
  ctx.strokeRect(0.004 * s, 0.196 * s, 0.042 * s, 0.030 * s);

  // SPQ-9B / illuminators atop hangar
  ctx.fillStyle = '#8a99a3';
  ctx.beginPath(); ctx.arc(-0.026 * s, 0.146 * s, 0.010 * s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0.026 * s, 0.146 * s, 0.010 * s, 0, 7); ctx.fill();

  // ── CIWS / SeaRAM aft ──
  ctx.fillStyle = '#98a8b2';
  ctx.beginPath(); ctx.arc(0, 0.118 * s, 0.011 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#2f3c44';
  ctx.fillRect(-0.004 * s, 0.100 * s, 0.008 * s, 0.016 * s);

  // ── FLIGHT DECK ──
  ctx.fillStyle = '#3e4d55';
  ctx.fillRect(-0.055 * s, 0.232 * s, 0.110 * s, 0.250 * s);
  // Deck outline
  ctx.strokeStyle = 'rgba(230,235,240,0.55)';
  ctx.lineWidth = Math.max(0.5, s * 0.0016);
  ctx.strokeRect(-0.050 * s, 0.240 * s, 0.100 * s, 0.232 * s);
  // Landing circle
  ctx.beginPath();
  ctx.arc(0, 0.352 * s, 0.038 * s, 0, Math.PI * 2);
  ctx.stroke();
  // "H" marking
  ctx.lineWidth = Math.max(0.6, s * 0.0022);
  ctx.beginPath();
  ctx.moveTo(-0.016 * s, 0.330 * s); ctx.lineTo(-0.016 * s, 0.374 * s);
  ctx.moveTo(0.016 * s, 0.330 * s); ctx.lineTo(0.016 * s, 0.374 * s);
  ctx.moveTo(-0.016 * s, 0.352 * s); ctx.lineTo(0.016 * s, 0.352 * s);
  ctx.stroke();
  // Deck grip lines
  ctx.strokeStyle = 'rgba(200,215,225,0.13)';
  ctx.lineWidth = Math.max(0.25, s * 0.0007);
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.048 * s, 0.245 * s + i * 0.028 * s);
    ctx.lineTo(0.048 * s, 0.245 * s + i * 0.028 * s);
    ctx.stroke();
  }

  // ── RUNNING LIGHTS ──
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-0.070 * s, -0.100 * s, 0.0055 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#30d158';
  ctx.beginPath(); ctx.arc(0.070 * s, -0.100 * s, 0.0055 * s, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,220,0.9)';
  ctx.beginPath(); ctx.arc(0, 0.488 * s, 0.005 * s, 0, 7); ctx.fill();

  // ── HULL NUMBER on bow ──
  if (s > 700) {
    ctx.save();
    ctx.fillStyle = 'rgba(235,240,245,0.75)';
    ctx.font = `bold ${0.030 * s}px monospace`;
    ctx.textAlign = 'center';
    ctx.translate(0, -0.250 * s);
    ctx.fillText('114', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

// Helper: draw a VLS block with individual cell hatches
function drawVLS(ctx, s, cx, cy, cols, rows, wFrac, hFrac, deckCol, darkCol, lightCol) {
  const w = wFrac * s, h = hFrac * s;
  ctx.fillStyle = deckCol;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = darkCol;
  ctx.lineWidth = Math.max(0.4, s * 0.0013);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

  const cw = w / cols, chh = h / rows;
  ctx.fillStyle = '#2c383f';
  ctx.strokeStyle = 'rgba(160,180,195,0.30)';
  ctx.lineWidth = Math.max(0.2, s * 0.0006);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = cx - w / 2 + i * cw + cw * 0.14;
      const y = cy - h / 2 + j * chh + chh * 0.14;
      const cwr = cw * 0.72, chr = chh * 0.72;
      ctx.fillRect(x, y, cwr, chr);
      if (s > 500) ctx.strokeRect(x, y, cwr, chr);
    }
  }
}

// ── UTILITIES ─────────────────────────────────────────────────
function factionColor(f) {
  switch (f) {
    case 'friendly': return '#4da6ff';
    case 'hostile':  return '#ff453a';
    case 'neutral':  return '#30d158';
    default:         return '#ffd60a';
  }
}

function shade(hex, amt) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

// Headless test export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Ship, DDG_SPEC, MAGAZINE, freshMagazine,
                     LOD_SYMBOL, LOD_DETAIL, factionColor };
}

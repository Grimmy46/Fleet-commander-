// ═══════════════════════════════════════════════════════════════
//  VEHICLE ART — recognisable top-down silhouettes
//  All helpers prefixed 'va' so they cannot collide with anything.
// ═══════════════════════════════════════════════════════════════

// Real lengths, used so vessels scale correctly against each other
const VA_LENGTH_M = {
  drone:       11.0,   // MQ-9 Reaper: 11 m long, 20 m span
  supertanker: 333.0,  // VLCC
  tanker:      245.0,  // Aframax / product tanker
  cargo:       200.0,
  skiff:        9.0,   // typical fibreglass skiff
  patrol:       55.0
};

function vaShade(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0,    'rgba(255,255,255,0.16)');
  g.addColorStop(0.5,  'rgba(255,255,255,0.02)');
  g.addColorStop(1,    'rgba(0,0,0,0.26)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// ── MQ-9 REAPER ───────────────────────────────────────────────
// From above the giveaways are the very long straight wing, the
// V-tail, and the rear-mounted propeller.
function vaDrone(ctx, L, col) {
  const halfSpan = L * 0.92;      // 20 m span on an 11 m body
  const fuseW = L * 0.085;

  // Wing — long, thin, slightly swept
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-halfSpan, -L * 0.02);
  ctx.lineTo(-halfSpan, L * 0.06);
  ctx.lineTo(-fuseW,    L * 0.14);
  ctx.lineTo( fuseW,    L * 0.14);
  ctx.lineTo( halfSpan, L * 0.06);
  ctx.lineTo( halfSpan, -L * 0.02);
  ctx.lineTo( fuseW,    L * 0.02);
  ctx.lineTo(-fuseW,    L * 0.02);
  ctx.closePath();
  ctx.fill();

  // Hardpoints under the wing
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  [0.34, 0.56, 0.76].forEach(f => {
    ctx.fillRect(-halfSpan * f - L * 0.03, L * 0.03, L * 0.06, L * 0.09);
    ctx.fillRect( halfSpan * f - L * 0.03, L * 0.03, L * 0.06, L * 0.09);
  });

  // Fuselage — bulbous sensor nose tapering to a slim tail boom
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.50);
  ctx.quadraticCurveTo( fuseW * 1.5, -L * 0.42,  fuseW * 1.35, -L * 0.24);
  ctx.lineTo( fuseW * 0.85, L * 0.20);
  ctx.lineTo( fuseW * 0.42, L * 0.44);
  ctx.lineTo(-fuseW * 0.42, L * 0.44);
  ctx.lineTo(-fuseW * 0.85, L * 0.20);
  ctx.lineTo(-fuseW * 1.35, -L * 0.24);
  ctx.quadraticCurveTo(-fuseW * 1.5, -L * 0.42, 0, -L * 0.50);
  ctx.closePath();
  ctx.fill();

  // Sensor ball under the nose
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.arc(0, -L * 0.36, fuseW * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal air intake
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(-fuseW * 0.5, -L * 0.16);
  ctx.lineTo( fuseW * 0.5, -L * 0.16);
  ctx.lineTo( fuseW * 0.35, L * 0.06);
  ctx.lineTo(-fuseW * 0.35, L * 0.06);
  ctx.closePath();
  ctx.fill();

  // V-tail — the strongest identifying feature from above
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-fuseW * 0.4, L * 0.30);
  ctx.lineTo(-L * 0.34, L * 0.56);
  ctx.lineTo(-L * 0.26, L * 0.58);
  ctx.lineTo(-fuseW * 0.2, L * 0.40);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo( fuseW * 0.4, L * 0.30);
  ctx.lineTo( L * 0.34, L * 0.56);
  ctx.lineTo( L * 0.26, L * 0.58);
  ctx.lineTo( fuseW * 0.2, L * 0.40);
  ctx.closePath(); ctx.fill();

  // Pusher propeller disc at the tail
  const spin = (performance.now() / 22) % (Math.PI * 2);
  ctx.save();
  ctx.translate(0, L * 0.47);
  ctx.strokeStyle = 'rgba(220,238,250,0.35)';
  ctx.lineWidth = Math.max(0.8, L * 0.022);
  for (let i = 0; i < 3; i++) {
    const a = spin + i * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * L * 0.17, Math.sin(a) * L * 0.17);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.14;
  ctx.beginPath(); ctx.arc(0, 0, L * 0.17, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ── TANKER ────────────────────────────────────────────────────
// Blunt bulbous bow, enormous flat deck, all superstructure aft.
function vaTanker(ctx, L, col, kind) {
  const B = L * (kind === 'supertanker' ? 0.182 : 0.165);   // real beam ratio
  const hw = B / 2;

  // Hull
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.50);
  ctx.quadraticCurveTo( hw * 0.92, -L * 0.44,  hw, -L * 0.30);
  ctx.lineTo( hw,  L * 0.40);
  ctx.quadraticCurveTo( hw,  L * 0.50,  hw * 0.72, L * 0.50);
  ctx.lineTo(-hw * 0.72, L * 0.50);
  ctx.quadraticCurveTo(-hw,  L * 0.50, -hw,  L * 0.40);
  ctx.lineTo(-hw, -L * 0.30);
  ctx.quadraticCurveTo(-hw * 0.92, -L * 0.44, 0, -L * 0.50);
  ctx.closePath();
  ctx.fill();
  vaShade(ctx, -hw, -L * 0.5, B, L);

  // Deck — lighter, with the manifold running down the centreline
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(-hw * 0.82, -L * 0.34, hw * 1.64, L * 0.62);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-hw * 0.06, -L * 0.34, hw * 0.12, L * 0.62);

  // Cargo tank divisions
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let i = 1; i < 6; i++) {
    ctx.fillRect(-hw * 0.82, -L * 0.34 + (L * 0.62 / 6) * i, hw * 1.64, L * 0.006);
  }

  // Superstructure right aft — the tanker signature
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillRect(-hw * 0.60, L * 0.30, hw * 1.20, L * 0.13);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillRect(-hw * 0.42, L * 0.33, hw * 0.84, L * 0.07);
  // Funnel
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.fillRect(-hw * 0.16, L * 0.42, hw * 0.32, L * 0.055);

  // Bow marking
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.47);
  ctx.lineTo(hw * 0.5, -L * 0.34);
  ctx.lineTo(-hw * 0.5, -L * 0.34);
  ctx.closePath(); ctx.fill();
}

// ── CARGO SHIP ────────────────────────────────────────────────
function vaCargo(ctx, L, col) {
  const B = L * 0.155, hw = B / 2;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.50);
  ctx.quadraticCurveTo( hw * 0.9, -L * 0.40,  hw, -L * 0.26);
  ctx.lineTo( hw,  L * 0.42);
  ctx.lineTo(-hw,  L * 0.42);
  ctx.lineTo(-hw, -L * 0.26);
  ctx.quadraticCurveTo(-hw * 0.9, -L * 0.40, 0, -L * 0.50);
  ctx.closePath(); ctx.fill();
  vaShade(ctx, -hw, -L * 0.5, B, L);

  // Container stacks
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-hw * 0.78, -L * 0.32 + i * L * 0.115, hw * 1.56, L * 0.085);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-hw * 0.06, -L * 0.32 + i * L * 0.115, hw * 0.12, L * 0.085);
  }
  // Bridge aft
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fillRect(-hw * 0.55, L * 0.30, hw * 1.10, L * 0.10);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(-hw * 0.14, L * 0.39, hw * 0.28, L * 0.045);
}

// ── SKIFF ─────────────────────────────────────────────────────
// Small open boat. Sharp bow, square transom, outboards, and a
// wake far out of proportion to its size.
function vaSkiff(ctx, L, col, speedKts) {
  const B = L * 0.30, hw = B / 2;

  // Hull — pointed bow, square stern
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.50);
  ctx.quadraticCurveTo( hw * 0.85, -L * 0.16,  hw, L * 0.22);
  ctx.lineTo( hw * 0.92, L * 0.42);
  ctx.lineTo(-hw * 0.92, L * 0.42);
  ctx.lineTo(-hw, L * 0.22);
  ctx.quadraticCurveTo(-hw * 0.85, -L * 0.16, 0, -L * 0.50);
  ctx.closePath(); ctx.fill();

  // Open interior
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.30);
  ctx.quadraticCurveTo( hw * 0.60, -L * 0.06,  hw * 0.70, L * 0.20);
  ctx.lineTo(-hw * 0.70, L * 0.20);
  ctx.quadraticCurveTo(-hw * 0.60, -L * 0.06, 0, -L * 0.30);
  ctx.closePath(); ctx.fill();

  // Thwarts
  ctx.fillStyle = `rgba(${vaRgb(col)},0.75)`;
  ctx.fillRect(-hw * 0.62, -L * 0.06, hw * 1.24, L * 0.05);
  ctx.fillRect(-hw * 0.68,  L * 0.08, hw * 1.36, L * 0.05);

  // Twin outboards on the transom
  ctx.fillStyle = 'rgba(20,26,34,0.9)';
  ctx.fillRect(-hw * 0.52, L * 0.40, hw * 0.34, L * 0.16);
  ctx.fillRect( hw * 0.18, L * 0.40, hw * 0.34, L * 0.16);

  // Wake — small boat, big spray
  if (speedKts > 6) {
    const k = Math.min(1, speedKts / 30);
    ctx.fillStyle = `rgba(220,240,255,${0.10 + k * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.9, L * 0.44);
    ctx.lineTo(-hw * 2.4 * k, L * (0.9 + k * 0.7));
    ctx.lineTo( hw * 2.4 * k, L * (0.9 + k * 0.7));
    ctx.lineTo( hw * 0.9, L * 0.44);
    ctx.closePath(); ctx.fill();
  }
}

// ── PATROL CRAFT ──────────────────────────────────────────────
function vaPatrol(ctx, L, col) {
  const B = L * 0.22, hw = B / 2;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.50);
  ctx.quadraticCurveTo( hw * 0.9, -L * 0.24,  hw, L * 0.08);
  ctx.lineTo( hw * 0.86, L * 0.46);
  ctx.lineTo(-hw * 0.86, L * 0.46);
  ctx.lineTo(-hw, L * 0.08);
  ctx.quadraticCurveTo(-hw * 0.9, -L * 0.24, 0, -L * 0.50);
  ctx.closePath(); ctx.fill();
  vaShade(ctx, -hw, -L * 0.5, B, L);
  // Pilothouse
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillRect(-hw * 0.52, -L * 0.10, hw * 1.04, L * 0.24);
  ctx.fillStyle = 'rgba(30,55,80,0.7)';
  ctx.fillRect(-hw * 0.40, -L * 0.06, hw * 0.80, L * 0.08);
  // Bow gun
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-hw * 0.09, -L * 0.36, hw * 0.18, L * 0.14);
  // Mast
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-hw * 0.05, -L * 0.14, hw * 0.10, L * 0.10);
}

function vaRgb(hex) {
  if (!hex || hex[0] !== '#') return '200,220,240';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

// Entry point. Returns true if it drew something recognisable.
function drawVehicle(ctx, type, L, col, opts) {
  const o = opts || {};
  switch (type) {
    case 'drone':       vaDrone(ctx, L, col); return true;
    case 'supertanker':
    case 'tanker':      vaTanker(ctx, L, col, type); return true;
    case 'cargo':       vaCargo(ctx, L, col); return true;
    case 'skiff':       vaSkiff(ctx, L, col, o.speed || 0); return true;
    case 'patrol':      vaPatrol(ctx, L, col); return true;
  }
  return false;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VA_LENGTH_M, drawVehicle };
}

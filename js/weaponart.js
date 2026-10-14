// ═══════════════════════════════════════════════════════════════
//  WEAPON ICONS — vector silhouettes, no image assets
//
//  Drawn to RELATIVE REAL SCALE against each other, so an SM-6
//  really does look longer than an ESSM and a 5" round really is
//  a stub next to a Tomahawk.
// ═══════════════════════════════════════════════════════════════

// Real lengths in metres. Used to size the silhouettes.
const WEAPON_LENGTH_M = {
  sm2:     4.72,   // RIM-66 SM-2MR
  sm6:     6.55,   // RIM-174 SM-6
  essm:    3.66,   // RIM-162 ESSM
  tomahawk:6.25,   // BGM-109 with booster
  asroc:   4.90,   // RUM-139 VL-ASROC
  torpedo: 2.72,   // Mk 54 lightweight
  gun:     0.68,   // 5" 62-cal complete round
  ciws:    0.17    // 20mm Phalanx round
};
const LONGEST_M = 6.55;

// Draw a weapon silhouette inside a box, scaled against the
// longest weapon in the inventory so comparisons are honest.
function drawWeaponIcon(ctx, key, x, y, boxW, boxH, col) {
  const lenM = WEAPON_LENGTH_M[key] || 3;
  // Never shrink below something legible
  const frac = Math.max(0.16, lenM / LONGEST_M);
  const L = boxW * frac;
  const cx = x + boxW * 0.5 - L * 0.5;

  ctx.save();
  ctx.translate(cx, y);

  switch (key) {
    case 'sm2':      waSM2(ctx, L, col); break;
    case 'sm6':      waSM6(ctx, L, col); break;
    case 'essm':     waESSM(ctx, L, col); break;
    case 'tomahawk': waTLAM(ctx, L, col); break;
    case 'asroc':    waASROC(ctx, L, col); break;
    case 'torpedo':  waTorpedo(ctx, L, col); break;
    case 'gun':      waShell(ctx, L, col); break;
    case 'ciws':     waCIWS(ctx, boxW * 0.5, col); break;
    default:         waGeneric(ctx, L, col);
  }
  ctx.restore();
}

// ── SHARED PARTS ──────────────────────────────────────────────
function waTube(ctx, L, r, col, noseFrac) {
  const nose = L * (noseFrac || 0.18);
  ctx.fillStyle = col;
  ctx.beginPath();
  // Ogive nose
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(nose * 0.55, -r * 0.92, nose, -r);
  ctx.lineTo(L, -r);
  ctx.lineTo(L, r);
  ctx.lineTo(nose, r);
  ctx.quadraticCurveTo(nose * 0.55, r * 0.92, 0, 0);
  ctx.closePath();
  ctx.fill();
}
function waFin(ctx, x, r, len, sweep, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, -r);
  ctx.lineTo(x + sweep, -r - len);
  ctx.lineTo(x + sweep + len * 0.5, -r - len);
  ctx.lineTo(x + len * 0.9, -r);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, r);
  ctx.lineTo(x + sweep, r + len);
  ctx.lineTo(x + sweep + len * 0.5, r + len);
  ctx.lineTo(x + len * 0.9, r);
  ctx.closePath(); ctx.fill();
}
function waBand(ctx, x, r, w, col, a) {
  ctx.fillStyle = `rgba(0,0,0,${a || 0.30})`;
  ctx.fillRect(x, -r, w, r * 2);
}
function waShade(ctx, L, r) {
  // Cylindrical body: bright highlight above centreline, deep
  // shadow below, so it reads as a tube and not a rectangle.
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0,    'rgba(255,255,255,0.10)');
  g.addColorStop(0.26, 'rgba(255,255,255,0.34)');
  g.addColorStop(0.50, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.22)');
  g.addColorStop(1,    'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, -r, L, r * 2);
  // Specular line along the top quarter
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(L * 0.04, -r * 0.68, L * 0.92, r * 0.10);
}

// Panel seams — small detail that stops it looking like a decal
function waSeams(ctx, L, r, positions) {
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  for (const f of positions) ctx.fillRect(L * f, -r, Math.max(0.7, L * 0.006), r * 2);
}

// Warhead / seeker section in a contrasting tone
function waSection(ctx, x, w, r, light) {
  ctx.fillStyle = light ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.20)';
  ctx.fillRect(x, -r, w, r * 2);
}

// ── SM-2MR ────────────────────────────────────────────────────
// Slim, long booster section, cruciform tail fins.
function waSM2(ctx, L, col) {
  const r = L * 0.052;
  waTube(ctx, L, r, col, 0.20);
  waSection(ctx, L * 0.20, L * 0.13, r, true);      // guidance section
  waShade(ctx, L, r);
  waSeams(ctx, L, r, [0.33, 0.46, 0.74]);
  waBand(ctx, L * 0.60, r, L * 0.020, col, 0.35);   // booster joint
  waFin(ctx, L * 0.34, r, r * 1.5, r * 0.5, col);   // mid wings
  waFin(ctx, L * 0.88, r, r * 2.0, r * 0.9, col);   // tail
  // Nozzle
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(L - r * 0.5, -r * 0.62, r * 0.5, r * 1.24);
}

// ── SM-6 ──────────────────────────────────────────────────────
// Longest round aboard. Blunter radome for the active seeker.
function waSM6(ctx, L, col) {
  const r = L * 0.050;
  waTube(ctx, L, r, col, 0.15);
  waShade(ctx, L, r);
  // Active seeker radome, lighter
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(L * 0.08, -r * 0.9, L * 0.15, -r);
  ctx.lineTo(L * 0.15, r);
  ctx.quadraticCurveTo(L * 0.08, r * 0.9, 0, 0);
  ctx.closePath(); ctx.fill();
  waSeams(ctx, L, r, [0.30, 0.44, 0.72]);
  waSection(ctx, L * 0.60, L * 0.34, r, false);     // booster, darker
  waBand(ctx, L * 0.58, r, L * 0.020, col, 0.35);
  waFin(ctx, L * 0.32, r, r * 1.4, r * 0.5, col);
  waFin(ctx, L * 0.88, r, r * 2.1, r * 0.9, col);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(L - r * 0.5, -r * 0.62, r * 0.5, r * 1.24);
}

// ── ESSM ──────────────────────────────────────────────────────
// Short and fat relative to the Standards. Quad-packed.
function waESSM(ctx, L, col) {
  const r = L * 0.072;
  waTube(ctx, L, r, col, 0.22);
  waShade(ctx, L, r);
  waSeams(ctx, L, r, [0.36, 0.62]);
  waFin(ctx, L * 0.80, r, r * 1.9, r * 0.8, col);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(L - r * 0.45, -r * 0.6, r * 0.45, r * 1.2);
  // Quad-pack marker — four dots
  ctx.fillStyle = `rgba(255,255,255,0.35)`;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(L * 0.42 + (i % 2) * r * 0.9, -r * 0.35 + Math.floor(i / 2) * r * 0.7,
            r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── TOMAHAWK ──────────────────────────────────────────────────
// Cruise missile: flat nose, pop-out wings, tail booster.
function waTLAM(ctx, L, col) {
  const r = L * 0.055;
  ctx.fillStyle = col;
  // Blunt cylindrical body
  ctx.beginPath();
  ctx.moveTo(L * 0.03, -r);
  ctx.quadraticCurveTo(0, -r * 0.5, 0, 0);
  ctx.quadraticCurveTo(0, r * 0.5, L * 0.03, r);
  ctx.lineTo(L * 0.86, r);
  ctx.lineTo(L * 0.86, -r);
  ctx.closePath(); ctx.fill();
  // Booster, narrower
  ctx.fillStyle = `rgba(${hexToRgbW(col)},0.75)`;
  ctx.fillRect(L * 0.86, -r * 0.72, L * 0.14, r * 1.44);
  waShade(ctx, L, r);
  // Deployed wings — the giveaway for a cruise missile
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(L * 0.40, -r);
  ctx.lineTo(L * 0.30, -r - L * 0.11);
  ctx.lineTo(L * 0.52, -r - L * 0.11);
  ctx.lineTo(L * 0.56, -r);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(L * 0.40, r);
  ctx.lineTo(L * 0.30, r + L * 0.11);
  ctx.lineTo(L * 0.52, r + L * 0.11);
  ctx.lineTo(L * 0.56, r);
  ctx.closePath(); ctx.fill();
  // Tail fins
  waFin(ctx, L * 0.90, r * 0.72, r * 1.5, r * 0.5, col);
  // Air inlet underneath
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(L * 0.60, r * 0.55, L * 0.16, r * 0.6);
}

// ── VL-ASROC ──────────────────────────────────────────────────
// Rocket with a torpedo payload — shown as a two-tone body.
function waASROC(ctx, L, col) {
  const r = L * 0.058;
  waTube(ctx, L, r, col, 0.20);
  waShade(ctx, L, r);
  // Payload section, lighter
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  ctx.fillRect(L * 0.16, -r, L * 0.30, r * 2);
  waBand(ctx, L * 0.46, r, L * 0.022, col, 0.4);
  waBand(ctx, L * 0.66, r, L * 0.018, col, 0.3);
  waFin(ctx, L * 0.86, r, r * 1.9, r * 0.8, col);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(L - r * 0.5, -r * 0.6, r * 0.5, r * 1.2);
}

// ── Mk 54 TORPEDO ─────────────────────────────────────────────
// Fat body, rounded nose, shrouded propulsor.
function waTorpedo(ctx, L, col) {
  const r = L * 0.105;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(L * 0.10, -r);
  ctx.quadraticCurveTo(-L * 0.02, -r * 0.55, -L * 0.02, 0);
  ctx.quadraticCurveTo(-L * 0.02, r * 0.55, L * 0.10, r);
  ctx.lineTo(L * 0.86, r);
  ctx.lineTo(L * 0.86, -r);
  ctx.closePath(); ctx.fill();
  waShade(ctx, L, r);
  // Sonar nose
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(L * 0.05, 0, L * 0.06, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  // Control fins
  waFin(ctx, L * 0.78, r, r * 0.85, r * 0.25, col);
  // Shrouded propulsor
  ctx.fillStyle = `rgba(${hexToRgbW(col)},0.6)`;
  ctx.fillRect(L * 0.86, -r * 1.05, L * 0.11, r * 2.1);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(L * 0.90, -r * 0.62, L * 0.05, r * 1.24);
}

// ── 5" SHELL ──────────────────────────────────────────────────
// Complete round: projectile plus brass case.
function waShell(ctx, L, col) {
  const r = L * 0.20;
  // Projectile
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(L * 0.16, -r * 0.86, L * 0.34, -r);
  ctx.lineTo(L * 0.52, -r);
  ctx.lineTo(L * 0.52, r);
  ctx.lineTo(L * 0.34, r);
  ctx.quadraticCurveTo(L * 0.16, r * 0.86, 0, 0);
  ctx.closePath(); ctx.fill();
  // Driving band
  waBand(ctx, L * 0.44, r, L * 0.05, col, 0.42);
  // Brass case, slightly wider
  ctx.fillStyle = `rgba(${hexToRgbW(col)},0.62)`;
  ctx.fillRect(L * 0.52, -r * 1.06, L * 0.44, r * 2.12);
  // Rim
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(L * 0.93, -r * 1.12, L * 0.07, r * 2.24);
  waShade(ctx, L, r);
}

// ── CIWS BURST ────────────────────────────────────────────────
// Not a round — the gun itself, since a 20mm shell is invisible.
function waCIWS(ctx, S, col) {
  const r = S * 0.16;
  // Radome
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(S * 0.30, 0, S * 0.19, r * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(S * 0.26, -r * 0.35, S * 0.10, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Gun barrels
  ctx.fillStyle = col;
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(S * 0.46, i * r * 0.42 - r * 0.10, S * 0.50, r * 0.20);
  }
  // Muzzle flash
  ctx.fillStyle = 'rgba(255,200,90,0.55)';
  ctx.beginPath();
  ctx.moveTo(S * 0.96, 0);
  ctx.lineTo(S * 1.10, -r * 0.55);
  ctx.lineTo(S * 1.04, 0);
  ctx.lineTo(S * 1.10, r * 0.55);
  ctx.closePath(); ctx.fill();
  // Mount base
  ctx.fillStyle = `rgba(${hexToRgbW(col)},0.55)`;
  ctx.fillRect(S * 0.18, r * 1.3, S * 0.26, r * 0.7);
}

function waGeneric(ctx, L, col) {
  const r = L * 0.06;
  waTube(ctx, L, r, col, 0.2);
  waShade(ctx, L, r);
  waFin(ctx, L * 0.86, r, r * 1.8, r * 0.7, col);
}

// ── DETAIL CARD ───────────────────────────────────────────────
// Large view of the armed weapon, with its real dimensions.
const WEAPON_DETAIL = {
  sm2:     { full:'RIM-66 SM-2MR Block IIIB', len:'4.72 m', mass:'708 kg',
             guide:'Semi-active radar homing', note:'Illuminator-limited. Four at once.' },
  sm6:     { full:'RIM-174 SM-6 Dual I',      len:'6.55 m', mass:'1,500 kg',
             guide:'Active radar seeker',      note:'Fire and forget. No illuminator needed.' },
  essm:    { full:'RIM-162 ESSM Block II',    len:'3.66 m', mass:'280 kg',
             guide:'Active / semi-active',     note:'Quad-packed. Four missiles per cell.' },
  tomahawk:{ full:'BGM-109 Tomahawk Block V', len:'6.25 m', mass:'1,600 kg',
             guide:'INS / TERCOM / DSMAC',     note:'Land attack. Cannot be reloaded at sea.' },
  asroc:   { full:'RUM-139 VL-ASROC',         len:'4.90 m', mass:'635 kg',
             guide:'Ballistic, then Mk 54',    note:'Rocket-delivered lightweight torpedo.' },
  torpedo: { full:'Mk 54 Lightweight Torpedo',len:'2.72 m', mass:'276 kg',
             guide:'Active / passive sonar',   note:'Mk 32 triple tubes, both sides.' },
  gun:     { full:'Mk 45 Mod 4  5"/62 cal',   len:'0.68 m', mass:'31 kg',
             guide:'Ballistic',                note:'20 rounds per minute. Cheap and plentiful.' },
  ciws:    { full:'Mk 15 Phalanx Block 1B',   len:'20 mm',  mass:'—',
             guide:'Closed-loop spotting',     note:'4,500 rounds per minute. Last ditch.' }
};

function drawWeaponCard(ctx, key, x, y, w, U, col) {
  const d = WEAPON_DETAIL[key];
  if (!d) return 0;
  const h = 132 * U;

  ctx.save();
  ctx.fillStyle = 'rgba(4,14,26,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(${hexToRgbW(col)},0.45)`;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, 3 * U, h);

  // Big silhouette
  drawWeaponIcon(ctx, key, x + 12 * U, y + 30 * U, w - 40 * U, 40 * U, col);

  // Scale rule beneath it
  ctx.strokeStyle = 'rgba(150,190,220,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 12 * U, y + 52 * U);
  ctx.lineTo(x + w - 28 * U, y + 52 * U);
  ctx.stroke();
  ctx.fillStyle = 'rgba(140,185,215,0.5)';
  ctx.font = `${8 * U}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(d.len, x + w / 2, y + 63 * U);

  ctx.textAlign = 'left';
  ctx.fillStyle = col;
  ctx.font = `bold ${9.5 * U}px monospace`;
  ctx.fillText(d.full, x + 12 * U, y + 18 * U);

  let ty = y + 80 * U;
  ctx.fillStyle = 'rgba(150,190,220,0.55)';
  ctx.font = `${8.5 * U}px monospace`;
  ctx.fillText(`MASS  ${d.mass}`, x + 12 * U, ty);
  ctx.fillText(`GUIDANCE  ${d.guide}`, x + 12 * U, ty + 12 * U);
  ctx.fillStyle = 'rgba(200,228,248,0.7)';
  ctx.font = `${8.5 * U}px monospace`;
  waWrapNote(ctx, d.note, x + 12 * U, ty + 28 * U, w - 26 * U, 11 * U);
  ctx.restore();
  return h;
}

function waWrapNote(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  for (const wd of words) {
    const test = line + wd + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trimEnd(), x, y); y += lh; line = wd + ' ';
    } else line = test;
  }
  if (line.trim()) ctx.fillText(line.trimEnd(), x, y);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEAPON_LENGTH_M, WEAPON_DETAIL, drawWeaponIcon, drawWeaponCard };
}

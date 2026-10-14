// ═══════════════════════════════════════════════════════════════
//  SCREENS — menu, globe, transit, briefing, debrief
// ═══════════════════════════════════════════════════════════════

const SCREEN = {
  MENU:     'menu',
  GLOBE:    'globe',
  TRANSIT:  'transit',
  BRIEFING: 'briefing',
  TACTICAL: 'tactical',
  DEBRIEF:  'debrief',
  INTRO:    'intro',
  CREDITS:  'credits',
  SHIPLOG:  'shiplog',
  REVEAL:   'reveal',
  SETTINGS: 'settings'
};

// Per-mission briefing art, loaded on demand and cached
const missionArt = {};
function getMissionArt(src) {
  if (!src) return null;
  if (missionArt[src] === undefined) {
    const im = new Image();
    im.onload = () => { im._ok = true; };
    im.onerror = () => { im._ok = false; console.warn('mission art missing:', src); };
    im.src = src;
    missionArt[src] = im;
  }
  const im = missionArt[src];
  return im && im._ok ? im : null;
}

// Loaded hero image
const heroImg = new Image();
let heroReady = false, heroFailed = false;
heroImg.onload  = () => { heroReady = true; };
heroImg.onerror = () => { heroFailed = true; console.warn('hero image failed to load'); };
heroImg.src = 'assets/ddg144.png';

// ── SHARED DRAW HELPERS ───────────────────────────────────────
function S_rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arc(x+w-r,y+r,r,-Math.PI/2,0);
  ctx.lineTo(x+w,y+h-r); ctx.arc(x+w-r,y+h-r,r,0,Math.PI/2);
  ctx.lineTo(x+r,y+h); ctx.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);
  ctx.lineTo(x,y+r); ctx.arc(x+r,y+r,r,Math.PI,-Math.PI/2);
  ctx.closePath();
}

// Cover-fit the hero image with a slow Ken Burns drift
function drawHero(ctx, W, H, t, opts = {}) {
  ctx.fillStyle = '#04080f';
  ctx.fillRect(0, 0, W, H);

  // Procedural fallback so the menu is never blank if the
  // image is missing or still loading.
  if (!heroReady) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#0a1830');
    g.addColorStop(0.45,'#12283f');
    g.addColorStop(0.55,'#0a1526');
    g.addColorStop(1,   '#040b16');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Horizon glow
    const hg = ctx.createRadialGradient(W*0.24, H*0.52, 0, W*0.24, H*0.52, W*0.42);
    hg.addColorStop(0, 'rgba(255,140,60,0.20)');
    hg.addColorStop(0.4,'rgba(180,80,40,0.07)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    // Sea lines
    ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = '#7fc4e8'; ctx.lineWidth = 1;
    const step = Math.max(60, W / 24);
    for (let i = 0; i < 14; i++) {
      const y = H*0.55 + i*(H*0.45/14);
      ctx.beginPath();
      for (let x = 0; x <= W; x += step) {
        const yy = y + Math.sin(x*0.004 + t*0.6 + i*0.3) * (2 + i*0.5);
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (!heroFailed) {
      ctx.fillStyle = 'rgba(140,190,225,0.25)';
      ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText('loading…', W/2, H - 24);
      ctx.textAlign = 'left';
    }
    // Still apply the scrim so text stays legible
    const bg = ctx.createLinearGradient(0, H*0.45, 0, H);
    bg.addColorStop(0, 'rgba(3,8,18,0)');
    bg.addColorStop(1, 'rgba(3,8,18,0.92)');
    ctx.fillStyle = bg; ctx.fillRect(0, H*0.45, W, H*0.55);
    return;
  }

  const zoom = 1.06 + Math.sin(t * 0.035) * 0.02;
  const iw = heroImg.width, ih = heroImg.height;
  const scale = Math.max(W / iw, H / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  const driftX = Math.sin(t * 0.021) * (dw - W) * 0.18;
  const driftY = Math.cos(t * 0.017) * Math.max(0, dh - H) * 0.14;
  const dx = (W - dw) / 2 + driftX;
  const dy = (H - dh) / 2 + driftY;

  ctx.save();
  ctx.globalAlpha = opts.alpha !== undefined ? opts.alpha : 1;
  ctx.drawImage(heroImg, dx, dy, dw, dh);
  ctx.restore();

  // Cool-tone grade so it sits with the game palette
  ctx.fillStyle = 'rgba(6,18,34,0.22)';
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.28, W/2, H/2, Math.max(W,H)*0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${0.60 + Math.sin(t*0.5)*0.02})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Bottom scrim for text legibility
  const bg = ctx.createLinearGradient(0, H*0.45, 0, H);
  bg.addColorStop(0, 'rgba(3,8,18,0)');
  bg.addColorStop(1, 'rgba(3,8,18,0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, H*0.45, W, H*0.55);

  // Scanlines as a cached pattern — one fill instead of ~500 rects
  ctx.save();
  ctx.globalAlpha = 0.030;
  ctx.fillStyle = scanPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── MAIN MENU ─────────────────────────────────────────────────
const MENU_ITEMS = [
  { id:'campaign', label:'CAMPAIGN',       sub:'Continue the operational tour' },
  { id:'single',   label:'SINGLE MISSION', sub:'Play any unlocked engagement' },
  { id:'deep',     label:'DEEP WATER',     sub:'Endless — hold until the magazine is dry' },
  { id:'settings', label:'SETTINGS',       sub:'Display, audio, controls' },
  { id:'credits',  label:'CREDITS',        sub:'Music and attributions' },
  { id:'exit',     label:'EXIT',           sub:'' }
];

function drawMenu(ctx, W, H, t, sel, btns) {
  drawHero(ctx, W, H, t);
  const U = uiScale(W, H);

  // Title block
  const tx = W * 0.085;
  let ty = H * 0.30;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(140,200,240,0.55)';
  ctx.font = `${11*U}px monospace`;
  setLS(ctx, `${5*U}px`);
  ctx.fillText('DDG-144  ·  ARLEIGH BURKE FLIGHT IIA  ·  SPEARPOINT GLOBAL SOLUTIONS', tx, ty);
  setLS(ctx, '0px');
  ty += 62*U;

  ctx.shadowColor = 'rgba(90,180,255,0.55)';
  ctx.shadowBlur = 34*U;
  ctx.fillStyle = '#e9f4ff';
  ctx.font = `bold ${76*U}px monospace`;
  setLS(ctx, `${2*U}px`);
  ctx.fillText('FLEET COMMAND', tx, ty);
  ctx.shadowBlur = 0;
  ty += 30*U;

  ctx.fillStyle = 'rgba(120,180,225,0.5)';
  ctx.font = `${13*U}px monospace`;
  setLS(ctx, `${7*U}px`);
  ctx.fillText('DEEP  WATER', tx, ty);
  setLS(ctx, '0px');
  ctx.restore();

  // Menu list
  let my = H * 0.52;
  const itemH = 52*U, itemW = 420*U;
  btns.length = 0;
  MENU_ITEMS.forEach((it, i) => {
    const on = sel === i;
    const y = my + i * (itemH + 6*U);
    if (on) {
      ctx.fillStyle = 'rgba(74,166,255,0.10)';
      S_rrect(ctx, tx - 14*U, y - 4*U, itemW, itemH, 4*U); ctx.fill();
      ctx.fillStyle = '#4da6ff';
      ctx.fillRect(tx - 14*U, y - 4*U, 3*U, itemH);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = on ? '#e9f4ff' : 'rgba(165,200,228,0.62)';
    ctx.font = `${on ? 'bold ' : ''}${22*U}px monospace`;
    setLS(ctx, `${2*U}px`);
    ctx.fillText(it.label, tx + (on ? 8*U : 0), y + 24*U);
    setLS(ctx, '0px');
    if (it.sub) {
      ctx.fillStyle = on ? 'rgba(140,195,235,0.72)' : 'rgba(110,150,180,0.32)';
      ctx.font = `${10*U}px monospace`;
      ctx.fillText(it.sub, tx + (on ? 8*U : 0), y + 41*U);
    }
    btns.push({ x: tx - 14*U, y: y - 4*U, w: itemW, h: itemH, idx: i, id: it.id });
  });

  // Footer
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(110,150,185,0.35)';
  ctx.font = `${10*U}px monospace`;
  ctx.fillText('↑↓ NAVIGATE   ·   ENTER SELECT   ·   N MUSIC   ·   F11 FULLSCREEN', W - 40*U, H - 28*U);
  drawNowPlaying(ctx, W, H, U);
}

// ── GLOBE ─────────────────────────────────────────────────────
class GlobeView {
  constructor() {
    this.cx = -40; this.cy = 20;    // centre lon/lat — Atlantic, ship in view
    this.zoom = 1.35;
    this.targetZoom = 1.35;
    this.hover = null;
    this.selected = null;
    // Offscreen cache for the static map layer
    this._cache = null;
    this._cacheKey = '';
  }
  cacheKey(vw, vh) {
    return `${this.cx.toFixed(2)}|${this.cy.toFixed(2)}|${this.zoom.toFixed(4)}|${vw}|${vh}`;
  }
  centreOn(lon, lat) { this.cx = lon; this.cy = lat; this._cacheKey = ''; }
  // equirectangular with zoom
  proj(lon, lat, W, H, vx, vy, vw, vh) {
    const s = (vw / 360) * this.zoom;
    return {
      x: vx + vw/2 + (lon - this.cx) * s,
      y: vy + vh/2 - (lat - this.cy) * s
    };
  }
  unproj(px, py, W, H, vx, vy, vw, vh) {
    const s = (vw / 360) * this.zoom;
    return {
      lon: this.cx + (px - vx - vw/2) / s,
      lat: this.cy - (py - vy - vh/2) / s
    };
  }
  update(dt) {
    const d = this.targetZoom / this.zoom;
    if (Math.abs(Math.log(d)) > 0.001) this.zoom *= Math.pow(d, Math.min(1, dt*8));
    else this.zoom = this.targetZoom;
  }
}

function drawGlobe(ctx, W, H, t, globe, camp, btns, mouse) {
  const U = uiScale(W, H);
  const PAD = 0;
  const HDR = 72*U, FTR = 128*U, SIDE = 340*U;
  const vx = PAD, vy = HDR, vw = W - SIDE, vh = H - HDR - FTR;

  // Ocean
  ctx.fillStyle = '#050f1e';
  ctx.fillRect(0, 0, W, H);
  const og = ctx.createLinearGradient(0, vy, 0, vy+vh);
  og.addColorStop(0, '#07182c');
  og.addColorStop(0.5, '#061426');
  og.addColorStop(1, '#040e1c');
  ctx.fillStyle = og;
  ctx.fillRect(vx, vy, vw, vh);

  ctx.save();
  ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();

  // ── STATIC LAYER (cached) ──
  const key = globe.cacheKey(Math.round(vw), Math.round(vh));
  if (globe._cacheKey !== key || !globe._cache) {
    const cw = Math.max(1, Math.round(vw)), chh = Math.max(1, Math.round(vh));
    if (!globe._cache || globe._cache.width !== cw || globe._cache.height !== chh) {
      globe._cache = document.createElement('canvas');
      globe._cache.width = cw; globe._cache.height = chh;
    }
    const g2 = globe._cache.getContext('2d');
    g2.clearRect(0, 0, cw, chh);
    // Draw in cache-local coordinates (origin at vx,vy)
    const P = (lon, lat) => {
      const q = globe.proj(lon, lat, W, H, vx, vy, vw, vh);
      return { x: q.x - vx, y: q.y - vy };
    };
    g2.strokeStyle = 'rgba(70,130,180,0.08)'; g2.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 15) {
      const a = P(lon, 90), b = P(lon, -90);
      g2.beginPath(); g2.moveTo(a.x, a.y); g2.lineTo(b.x, b.y); g2.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const a = P(-180, lat), b = P(180, lat);
      g2.beginPath(); g2.moveTo(a.x, a.y); g2.lineTo(b.x, b.y); g2.stroke();
    }
    const eqC = P(0, 0);
    g2.strokeStyle = 'rgba(90,160,210,0.16)';
    g2.setLineDash([6,8]);
    g2.beginPath(); g2.moveTo(0, eqC.y); g2.lineTo(cw, eqC.y); g2.stroke();
    g2.setLineDash([]);
    for (const c of CONTINENTS) {
      g2.beginPath();
      c.pts.forEach((p, i) => {
        const q = P(p[0], p[1]);
        i === 0 ? g2.moveTo(q.x, q.y) : g2.lineTo(q.x, q.y);
      });
      g2.closePath();
      g2.fillStyle = '#16202c'; g2.fill();
      g2.strokeStyle = 'rgba(120,170,205,0.30)'; g2.lineWidth = 1.1; g2.stroke();
    }
    globe._cacheKey = key;
  }
  ctx.drawImage(globe._cache, vx, vy);

  // Ports
  for (const p of camp.ports) {
    const q = globe.proj(p.lon, p.lat, W,H,vx,vy,vw,vh);
    if (q.x < vx-20 || q.x > vx+vw+20 || q.y < vy-20 || q.y > vy+vh+20) continue;
    const col = !p.unlocked ? 'rgba(90,110,130,0.45)' : p.type === 'navy' ? '#4da6ff' : '#30d158';
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(q.x, q.y, 4.5*U, 0, Math.PI*2); ctx.stroke();
    if (p.unlocked) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 1.8*U, 0, Math.PI*2); ctx.fill(); }
    if (globe.zoom > 1.6) {
      ctx.fillStyle = p.unlocked ? 'rgba(190,220,245,0.65)' : 'rgba(120,145,170,0.4)';
      ctx.font = `${9*U}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(p.name, q.x + 8*U, q.y + 3*U);
    }
  }

  // Mission markers
  const avail = camp.availableMissions();
  btns.length = 0;
  for (const m of avail) {
    const q = globe.proj(m.lon, m.lat, W,H,vx,vy,vw,vh);
    if (q.x < vx-30 || q.x > vx+vw+30 || q.y < vy-30 || q.y > vy+vh+30) continue;
    const MT = MISSION_TYPE[m.type];
    const isSel = globe.selected === m;
    const isHov = globe.hover === m;
    const pulse = 0.5 + Math.sin(t*3 + m.lon)*0.5;

    // Outer pulse ring
    ctx.strokeStyle = `rgba(${hexRgbS(MT.col)},${0.16 + pulse*0.22})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(q.x, q.y, (11 + pulse*7)*U, 0, Math.PI*2); ctx.stroke();

    // Diamond
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(Math.PI/4);
    const s = (isSel||isHov ? 8 : 6.5)*U;
    ctx.fillStyle = `rgba(${hexRgbS(MT.col)},0.22)`;
    ctx.fillRect(-s, -s, s*2, s*2);
    ctx.strokeStyle = MT.col; ctx.lineWidth = isSel ? 2.2 : 1.6;
    ctx.strokeRect(-s, -s, s*2, s*2);
    ctx.restore();

    if (isSel || isHov || globe.zoom > 1.4) {
      ctx.fillStyle = MT.col;
      ctx.font = `bold ${9.5*U}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(m.name, q.x + 14*U, q.y - 1*U);
      ctx.fillStyle = 'rgba(180,210,235,0.5)';
      ctx.font = `${8*U}px monospace`;
      ctx.fillText(MT.label, q.x + 14*U, q.y + 10*U);
    }
    btns.push({ x: q.x-14*U, y: q.y-14*U, w: 28*U, h: 28*U, mission: m });
  }

  // Ship position + track to selection
  const sp = globe.proj(camp.shipLon, camp.shipLat, W,H,vx,vy,vw,vh);
  if (globe.selected) {
    const tq = globe.proj(globe.selected.lon, globe.selected.lat, W,H,vx,vy,vw,vh);
    ctx.strokeStyle = 'rgba(255,214,10,0.42)';
    ctx.setLineDash([5,7]); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const g = gcInterp(camp.shipLon, camp.shipLat, globe.selected.lon, globe.selected.lat, i/40);
      const pq = globe.proj(g.lon, g.lat, W,H,vx,vy,vw,vh);
      i === 0 ? ctx.moveTo(pq.x, pq.y) : ctx.lineTo(pq.x, pq.y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // Ownship marker
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(sp.x, sp.y, 7*U, Math.PI, 0);
  ctx.moveTo(sp.x-7*U, sp.y); ctx.lineTo(sp.x+7*U, sp.y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${8.5*U}px monospace`; ctx.textAlign = 'center';
  ctx.fillText('DDG-144', sp.x, sp.y - 13*U);
  ctx.restore();

  ctx.restore(); // unclip

  // ── HEADER ──
  ctx.fillStyle = 'rgba(4,12,24,0.96)';
  ctx.fillRect(0, 0, W, HDR);
  ctx.strokeStyle = 'rgba(70,140,190,0.35)';
  ctx.beginPath(); ctx.moveTo(0,HDR); ctx.lineTo(W,HDR); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4da6ff'; ctx.font = `bold ${17*U}px monospace`;
  ctx.fillText('◈ OPERATIONS', 26*U, 30*U);
  ctx.fillStyle = 'rgba(150,190,225,0.5)'; ctx.font = `${10*U}px monospace`;
  ctx.fillText(`DDG-144  ·  ${camp.operator || 'INDEPENDENT OPERATIONS'}`, 26*U, 50*U);
  // Clock
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f2fa'; ctx.font = `bold ${20*U}px monospace`;
  ctx.fillText(camp.clock.fmtTime(), W/2 - 70*U, 34*U);
  ctx.fillStyle = 'rgba(150,190,225,0.65)'; ctx.font = `${13*U}px monospace`;
  ctx.fillText(camp.clock.fmtDate(), W/2 + 60*U, 34*U);
  ctx.fillStyle = 'rgba(110,150,185,0.4)'; ctx.font = `${9*U}px monospace`;
  ctx.fillText(`DAY ${camp.clock.dayNumber}`, W/2, 52*U);
  // Credits
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(48,209,88,0.85)'; ctx.font = `bold ${16*U}px monospace`;
  ctx.fillText(`$${camp.credits.toLocaleString()}`, W - 26*U, 32*U);
  ctx.fillStyle = 'rgba(110,150,185,0.45)'; ctx.font = `${9*U}px monospace`;
  ctx.fillText('OPERATING FUNDS', W - 26*U, 50*U);

  // ── SIDE PANEL ──
  const sx0 = W - SIDE;
  ctx.fillStyle = 'rgba(4,12,24,0.96)';
  ctx.fillRect(sx0, HDR, SIDE, H - HDR);
  ctx.strokeStyle = 'rgba(70,140,190,0.3)';
  ctx.beginPath(); ctx.moveTo(sx0, HDR); ctx.lineTo(sx0, H); ctx.stroke();

  let py = HDR + 26*U;
  const lx = sx0 + 20*U;
  ctx.textAlign = 'left';

  if (globe.selected) {
    const m = globe.selected, MT = MISSION_TYPE[m.type];
    ctx.fillStyle = MT.col; ctx.font = `bold ${9*U}px monospace`;
    setLS(ctx, `${2*U}px`);
    ctx.fillText(MT.label, lx, py); setLS(ctx, '0px');
    py += 24*U;
    ctx.fillStyle = '#e9f4ff'; ctx.font = `bold ${20*U}px monospace`;
    ctx.fillText(m.name, lx, py); py += 18*U;
    ctx.fillStyle = 'rgba(150,190,225,0.6)'; ctx.font = `${10*U}px monospace`;
    ctx.fillText(m.subtitle, lx, py); py += 26*U;

    // Distance / transit
    const dist = camp.distanceTo(m.lon, m.lat);
    const hrs = camp.transitHours(m.lon, m.lat);
    ctx.fillStyle = 'rgba(90,150,195,0.55)'; ctx.font = `${9*U}px monospace`;
    ctx.fillText('DISTANCE', lx, py);
    ctx.fillText('TRANSIT AT 18 KTS', lx + 130*U, py);
    py += 16*U;
    ctx.fillStyle = '#e8f2fa'; ctx.font = `bold ${14*U}px monospace`;
    ctx.fillText(`${Math.round(dist).toLocaleString()} nm`, lx, py);
    const days = Math.floor(hrs/24), rem = Math.round(hrs%24);
    ctx.fillText(days > 0 ? `${days}d ${rem}h` : `${rem}h`, lx + 130*U, py);
    py += 24*U;

    // Brief
    ctx.strokeStyle = 'rgba(70,140,190,0.2)';
    ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(W-20*U, py); ctx.stroke();
    py += 18*U;
    ctx.fillStyle = 'rgba(190,220,245,0.72)'; ctx.font = `${10*U}px monospace`;
    py = wrapText(ctx, m.brief, lx, py, SIDE - 44*U, 15*U);
    py += 12*U;

    // Handler message
    ctx.fillStyle = 'rgba(90,150,195,0.5)'; ctx.font = `${8.5*U}px monospace`;
    setLS(ctx, `${1.5*U}px`);
    ctx.fillText('◆ EVA', lx, py); setLS(ctx, '0px');
    py += 15*U;
    ctx.fillStyle = 'rgba(140,200,240,0.62)'; ctx.font = `italic ${10*U}px monospace`;
    py = wrapText(ctx, '"' + m.handler + '"', lx, py, SIDE - 44*U, 14*U);
    py += 16*U;

    // Payment
    if (m.payment > 0) {
      ctx.fillStyle = 'rgba(48,209,88,0.85)'; ctx.font = `bold ${13*U}px monospace`;
      ctx.fillText(`PAYMENT  $${m.payment.toLocaleString()}`, lx, py);
    } else if (MISSION_TYPE[m.type].freeRearm) {
      ctx.fillStyle = 'rgba(77,166,255,0.85)'; ctx.font = `bold ${11*U}px monospace`;
      ctx.fillText('USN TASKING — FULL REARM AUTHORISED', lx, py);
    } else {
      ctx.fillStyle = 'rgba(150,175,195,0.6)'; ctx.font = `${11*U}px monospace`;
      ctx.fillText('NO PAYMENT', lx, py);
    }
    py += 26*U;

    // Buttons
    const bw = SIDE - 40*U, bh = 44*U;
    const acceptY = H - 130*U;
    const bl = 0.55 + Math.sin(t*4)*0.45;
    ctx.fillStyle = `rgba(48,209,88,${0.12 + bl*0.10})`;
    S_rrect(ctx, lx, acceptY, bw, bh, 4*U); ctx.fill();
    ctx.strokeStyle = `rgba(48,209,88,${0.55 + bl*0.35})`; ctx.lineWidth = 1.8;
    S_rrect(ctx, lx, acceptY, bw, bh, 4*U); ctx.stroke();
    ctx.fillStyle = '#4ef09a'; ctx.font = `bold ${14*U}px monospace`; ctx.textAlign = 'center';
    ctx.fillText('ACCEPT TASKING', lx + bw/2, acceptY + 27*U);
    btns.push({ x: lx, y: acceptY, w: bw, h: bh, action: 'accept' });

    if (m.refusable) {
      const refY = acceptY + bh + 8*U;
      ctx.fillStyle = 'rgba(255,69,58,0.06)';
      S_rrect(ctx, lx, refY, bw, 32*U, 4*U); ctx.fill();
      ctx.strokeStyle = 'rgba(255,69,58,0.35)'; ctx.lineWidth = 1.2;
      S_rrect(ctx, lx, refY, bw, 32*U, 4*U); ctx.stroke();
      ctx.fillStyle = 'rgba(255,110,100,0.75)'; ctx.font = `${11*U}px monospace`;
      ctx.fillText('DECLINE', lx + bw/2, refY + 20*U);
      btns.push({ x: lx, y: refY, w: bw, h: 32*U, action: 'refuse' });
    }
    ctx.textAlign = 'left';
  } else {
    // No selection — show news feed
    ctx.fillStyle = 'rgba(90,150,195,0.6)'; ctx.font = `bold ${9*U}px monospace`;
    setLS(ctx, `${2*U}px`);
    ctx.fillText('FLEET TRAFFIC', lx, py); setLS(ctx, '0px');
    py += 22*U;
    if (!camp.newsFeed.length) {
      ctx.fillStyle = 'rgba(100,140,175,0.35)'; ctx.font = `${10*U}px monospace`;
      ctx.fillText('No traffic.', lx, py); py += 20*U;
      ctx.fillStyle = 'rgba(100,140,175,0.28)'; ctx.font = `${9*U}px monospace`;
      py = wrapText(ctx, 'Select a mission marker on the chart to review tasking.', lx, py, SIDE-44*U, 13*U);
    }
    for (const n of camp.newsFeed.slice(0, 10)) {
      const exposed = n.lie && camp.sabotageKnown;
      const c = exposed ? '#ff4d3d'
              : n.kind === 'bad' ? '#ff6b5e'
              : n.kind === 'good' ? '#4ef09a' : 'rgba(180,215,240,0.75)';
      ctx.fillStyle = 'rgba(90,130,165,0.35)'; ctx.font = `${8*U}px monospace`;
      ctx.fillText(n.stamp, lx, py); py += 12*U;
      const hy = py;
      ctx.fillStyle = c; ctx.font = `bold ${10*U}px monospace`;
      py = wrapText(ctx, n.headline, lx, py, SIDE-44*U, 13*U);
      // Once you know, the denial reads as what it is
      if (exposed) {
        ctx.strokeStyle = 'rgba(255,77,61,0.55)';
        ctx.lineWidth = 1.2;
        for (let ly = hy - 3*U; ly < py - 10*U; ly += 13*U) {
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + SIDE - 48*U, ly); ctx.stroke();
        }
        ctx.fillStyle = '#ff4d3d'; ctx.font = `bold ${8*U}px monospace`;
        ctx.fillText('◆ KNOWN FALSE', lx, py); py += 12*U;
      }
      if (n.detail) {
        ctx.fillStyle = exposed ? 'rgba(210,150,140,0.5)' : 'rgba(140,175,205,0.5)';
        ctx.font = `${9*U}px monospace`;
        py = wrapText(ctx, n.detail, lx, py, SIDE-44*U, 12*U);
      }
      py += 12*U;
      if (py > H - 40*U) break;
    }
  }

  // ── FOOTER ──
  ctx.fillStyle = 'rgba(4,12,24,0.96)';
  ctx.fillRect(0, H-FTR, W-SIDE, FTR);
  ctx.strokeStyle = 'rgba(70,140,190,0.3)';
  ctx.beginPath(); ctx.moveTo(0,H-FTR); ctx.lineTo(W-SIDE,H-FTR); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(90,150,195,0.55)'; ctx.font = `bold ${9*U}px monospace`;
  setLS(ctx, `${2*U}px`);
  ctx.fillText('AVAILABLE TASKING', 26*U, H-FTR+22*U);
  setLS(ctx, '0px');
  let fx = 26*U;
  for (const m of avail) {
    const MT = MISSION_TYPE[m.type];
    const on = globe.selected === m;
    const cw = 200*U;
    if (on) { ctx.fillStyle = `rgba(${hexRgbS(MT.col)},0.10)`; ctx.fillRect(fx-6*U, H-FTR+32*U, cw, 62*U); }
    ctx.fillStyle = MT.col; ctx.fillRect(fx-6*U, H-FTR+32*U, 2.5*U, 62*U);
    ctx.fillStyle = on ? '#e9f4ff' : 'rgba(175,205,230,0.7)';
    ctx.font = `bold ${11*U}px monospace`;
    ctx.fillText(m.name, fx+4*U, H-FTR+50*U);
    ctx.fillStyle = 'rgba(120,160,195,0.45)'; ctx.font = `${8.5*U}px monospace`;
    ctx.fillText(m.subtitle.slice(0,28), fx+4*U, H-FTR+65*U);
    const dd = Math.round(camp.distanceTo(m.lon, m.lat));
    ctx.fillStyle = MT.col; ctx.font = `${8.5*U}px monospace`;
    ctx.fillText(`${dd.toLocaleString()} nm  ·  ${MT.label}`, fx+4*U, H-FTR+80*U);
    btns.push({ x: fx-6*U, y: H-FTR+32*U, w: cw, h: 62*U, mission: m });
    fx += cw + 12*U;
    if (fx > W - SIDE - 120*U) break;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(100,140,175,0.3)'; ctx.font = `${8.5*U}px monospace`;
  ctx.fillText("CLICK MARKER  ·  WHEEL ZOOM  ·  DRAG PAN  ·  B SHIP'S LOG  ·  ESC MENU", W-SIDE-20*U, H-10*U);
}

// ── TRANSIT ───────────────────────────────────────────────────
function drawTransit(ctx, W, H, t, tr, camp, btns) {
  const U = uiScale(W, H);
  drawHero(ctx, W, H, t, { alpha: 1 });

  const prog = Math.min(1, tr.elapsed / tr.totalHours);
  const cx = W/2;

  // Top strip
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(140,200,240,0.5)';
  ctx.font = `${11*U}px monospace`;
  setLS(ctx, `${5*U}px`);
  ctx.fillText('UNDER WAY', cx, H*0.16);
  setLS(ctx, '0px');

  ctx.fillStyle = '#e9f4ff';
  ctx.font = `bold ${40*U}px monospace`;
  ctx.fillText(tr.destName, cx, H*0.16 + 52*U);

  ctx.fillStyle = 'rgba(150,195,230,0.55)';
  ctx.font = `${12*U}px monospace`;
  ctx.fillText(tr.destSub, cx, H*0.16 + 78*U);

  // Bottom info block
  const by = H * 0.68;

  // Progress bar
  const bw = W*0.52, bx = cx - bw/2;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(bx, by, bw, 5*U);
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(bx, by, bw*prog, 5*U);
  ctx.strokeStyle = 'rgba(120,180,220,0.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, 5*U);
  // Ship glyph riding the bar
  const shx = bx + bw*prog;
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(shx, by+2.5*U, 6*U, Math.PI, 0);
  ctx.moveTo(shx-6*U, by+2.5*U); ctx.lineTo(shx+6*U, by+2.5*U);
  ctx.stroke();
  ctx.restore();

  // Readouts
  const stats = [
    ['DISTANCE REMAINING', `${Math.round(tr.totalNm*(1-prog)).toLocaleString()} nm`],
    ['SPEED OF ADVANCE',   `${tr.speed} kts`],
    ['ETA',                fmtRemain(tr.totalHours - tr.elapsed)],
    ['DATE',               camp.clock.fmtDate()]
  ];
  const colW = bw / stats.length;
  stats.forEach((s, i) => {
    const x = bx + colW*i + colW/2;
    ctx.fillStyle = 'rgba(110,160,200,0.5)'; ctx.font = `${9*U}px monospace`;
    ctx.fillText(s[0], x, by + 30*U);
    ctx.fillStyle = '#e8f2fa'; ctx.font = `bold ${17*U}px monospace`;
    ctx.fillText(s[1], x, by + 54*U);
  });

  // Speed controls
  btns.length = 0;
  const spds = [12, 18, 24, 30];
  const sw = 62*U, sy = by + 76*U;
  const sx0 = cx - (spds.length*(sw+6*U))/2;
  ctx.font = `${9*U}px monospace`;
  ctx.fillStyle = 'rgba(110,160,200,0.45)';
  ctx.fillText('SPEED OF ADVANCE', cx, sy - 6*U);
  spds.forEach((s, i) => {
    const x = sx0 + i*(sw+6*U);
    const on = tr.speed === s;
    ctx.fillStyle = on ? 'rgba(77,166,255,0.18)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, sy, sw, 26*U);
    ctx.strokeStyle = on ? 'rgba(77,166,255,0.85)' : 'rgba(90,140,180,0.25)';
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.strokeRect(x, sy, sw, 26*U);
    ctx.fillStyle = on ? '#7cc4ff' : 'rgba(140,180,210,0.55)';
    ctx.font = `${on?'bold ':''}${11*U}px monospace`;
    ctx.fillText(`${s} kts`, x + sw/2, sy + 17*U);
    btns.push({ x, y: sy, w: sw, h: 26*U, speed: s });
  });

  // Skip
  const skw = 200*U, sky = sy + 44*U;
  const bl = 0.5 + Math.sin(t*4)*0.5;
  ctx.fillStyle = `rgba(255,214,10,${0.08+bl*0.08})`;
  S_rrect(ctx, cx-skw/2, sky, skw, 36*U, 4*U); ctx.fill();
  ctx.strokeStyle = `rgba(255,214,10,${0.45+bl*0.3})`; ctx.lineWidth = 1.5;
  S_rrect(ctx, cx-skw/2, sky, skw, 36*U, 4*U); ctx.stroke();
  ctx.fillStyle = '#ffd60a'; ctx.font = `bold ${12*U}px monospace`;
  ctx.fillText('ADVANCE TO ARRIVAL  [SPACE]', cx, sky + 23*U);
  btns.push({ x: cx-skw/2, y: sky, w: skw, h: 36*U, action: 'skip' });

  ctx.textAlign = 'left';
}

function fmtRemain(h) {
  if (h <= 0) return 'ARRIVING';
  const d = Math.floor(h/24), r = Math.floor(h%24), m = Math.round((h%1)*60);
  if (d > 0) return `${d}d ${r}h`;
  if (r > 0) return `${r}h ${m}m`;
  return `${m}m`;
}

// ── BRIEFING ──────────────────────────────────────────────────
function drawBriefing(ctx, W, H, t, m, camp, btns) {
  const U = uiScale(W, H);
  const art = getMissionArt(m && m.art);
  if (art) {
    // Mission-specific art, cover-fit with a slow drift
    ctx.fillStyle = '#04080f'; ctx.fillRect(0, 0, W, H);
    const zoom = 1.05 + Math.sin(t * 0.03) * 0.018;
    const sc = Math.max(W / art.width, H / art.height) * zoom;
    const dw = art.width * sc, dh = art.height * sc;
    ctx.drawImage(art, (W - dw) / 2 + Math.sin(t * 0.02) * (dw - W) * 0.12,
                       (H - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(6,18,34,0.30)'; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.30,
                                        W/2, H/2, Math.max(W,H)*0.80);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const lg = ctx.createLinearGradient(0, 0, W * 0.62, 0);
    lg.addColorStop(0, 'rgba(3,8,18,0.88)');
    lg.addColorStop(1, 'rgba(3,8,18,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W * 0.62, H);
    ctx.save(); ctx.globalAlpha = 0.028;
    ctx.fillStyle = scanPattern(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
  } else {
    drawHero(ctx, W, H, t);
  }
  const MT = MISSION_TYPE[m.type];
  const lx = W*0.10;
  let y = H*0.22;

  ctx.textAlign = 'left';
  ctx.fillStyle = MT.col; ctx.font = `bold ${11*U}px monospace`;
  setLS(ctx, `${4*U}px`);
  ctx.fillText(MT.label, lx, y); setLS(ctx, '0px');
  y += 46*U;
  ctx.fillStyle = '#e9f4ff'; ctx.font = `bold ${52*U}px monospace`;
  ctx.fillText(m.name, lx, y);
  y += 26*U;
  ctx.fillStyle = 'rgba(150,195,230,0.6)'; ctx.font = `${14*U}px monospace`;
  ctx.fillText(m.subtitle, lx, y);
  y += 40*U;

  ctx.strokeStyle = `rgba(${hexRgbS(MT.col)},0.3)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + W*0.44, y); ctx.stroke();
  y += 26*U;

  ctx.fillStyle = 'rgba(200,228,248,0.8)'; ctx.font = `${13*U}px monospace`;
  y = wrapText(ctx, m.brief, lx, y, W*0.44, 21*U);
  y += 26*U;

  ctx.fillStyle = 'rgba(110,165,205,0.5)'; ctx.font = `${9*U}px monospace`;
  setLS(ctx, `${2*U}px`);
  ctx.fillText('◆ EVA — SPEARPOINT OPERATIONS', lx, y); setLS(ctx, '0px');
  y += 20*U;
  ctx.fillStyle = 'rgba(150,205,245,0.7)'; ctx.font = `italic ${12*U}px monospace`;
  y = wrapText(ctx, '"' + m.handler + '"', lx, y, W*0.44, 18*U);

  // Launch button
  const bw = 300*U, bh = 52*U, bx = lx, by = H*0.78;
  const bl = 0.55 + Math.sin(t*4)*0.45;
  ctx.fillStyle = `rgba(48,209,88,${0.12+bl*0.10})`;
  S_rrect(ctx, bx, by, bw, bh, 5*U); ctx.fill();
  ctx.strokeStyle = `rgba(48,209,88,${0.6+bl*0.3})`; ctx.lineWidth = 2;
  S_rrect(ctx, bx, by, bw, bh, 5*U); ctx.stroke();
  ctx.fillStyle = '#4ef09a'; ctx.font = `bold ${16*U}px monospace`; ctx.textAlign = 'center';
  ctx.fillText('COMMENCE  [ENTER]', bx + bw/2, by + 32*U);
  btns.length = 0;
  btns.push({ x: bx, y: by, w: bw, h: bh, action: 'start' });

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(110,150,185,0.35)'; ctx.font = `${10*U}px monospace`;
  ctx.fillText('ESC — RETURN TO CHART', lx, by + bh + 26*U);
}

// ── SETTINGS ──────────────────────────────────────────────────
function drawSettings(ctx, W, H, t, cfg, btns) {
  const U = uiScale(W, H);
  drawHero(ctx, W, H, t, { alpha: 0.5 });
  ctx.fillStyle = 'rgba(3,9,18,0.72)'; ctx.fillRect(0,0,W,H);

  const lx = W*0.12;
  let y = H*0.20;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4da6ff'; ctx.font = `bold ${34*U}px monospace`;
  ctx.fillText('SETTINGS', lx, y);
  y += 50*U;

  btns.length = 0;
  const rows = [
    { id:'fullscreen', label:'FULLSCREEN',      val: cfg.fullscreen ? 'ON' : 'OFF', hint:'F11 toggles at any time' },
    { id:'audio',      label:'AUDIO',           val: Audio.enabled ? 'ON' : 'MUTED', hint:'M toggles in mission' },
    { id:'volume',     label:'EFFECTS VOLUME',  val: `${Math.round(Audio.volume*100)}%`, hint:'[ and ] adjust', slider:true },
    { id:'music',      label:'MUSIC',           val: MusicSys.enabled ? 'ON' : 'OFF', hint:'N toggles anywhere' },
    { id:'musicvol',   label:'MUSIC VOLUME',    val: `${Math.round(MusicSys.volume*100)}%`, hint:', and . adjust', slider:true },
    { id:'autoslow',   label:'AUTO-SLOW ON ALARM', val: cfg.autoSlow ? 'ON' : 'OFF', hint:'Drops to 1x when threats appear' },
    { id:'uiscale',    label:'UI SCALE',        val: `${Math.round(cfg.uiScale*100)}%`, hint:'For high-DPI displays', slider:true },
    { id:'credits',    label:'CREDITS',         val: '▸', hint:'Music attribution' }
  ];
  for (const r of rows) {
    ctx.fillStyle = 'rgba(180,215,240,0.8)'; ctx.font = `${15*U}px monospace`;
    ctx.fillText(r.label, lx, y);
    ctx.fillStyle = '#7cc4ff'; ctx.font = `bold ${15*U}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(r.val, lx + 460*U, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(110,150,185,0.4)'; ctx.font = `${9.5*U}px monospace`;
    ctx.fillText(r.hint, lx + 490*U, y);
    btns.push({ x: lx-10*U, y: y-20*U, w: 500*U, h: 30*U, setting: r.id });
    y += 44*U;
  }

  y += 30*U;
  ctx.fillStyle = 'rgba(110,150,185,0.4)'; ctx.font = `${11*U}px monospace`;
  ctx.fillText('ESC — BACK', lx, y);
}

// ── UTILITIES ─────────────────────────────────────────────────
// Cached scanline tile — built once, reused every frame
let _scanPat = null;
function scanPattern(ctx) {
  if (_scanPat) return _scanPat;
  const c = document.createElement('canvas');
  c.width = 1; c.height = 3;
  const g = c.getContext('2d');
  g.fillStyle = '#8fd4ff';
  g.fillRect(0, 0, 1, 1);
  _scanPat = ctx.createPattern(c, 'repeat');
  return _scanPat;
}

// Safe letterSpacing — silently ignored where unsupported
function setLS(ctx, v) { try { ctx.letterSpacing = v; } catch (e) {} }

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trimEnd(), x, y);
      y += lh; line = w + ' ';
    } else line = test;
  }
  if (line.trim()) { ctx.fillText(line.trimEnd(), x, y); y += lh; }
  return y;
}

function hexRgbS(h) {
  return `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
}

// Scale factor for high-DPI / 4K displays
let _uiScaleOverride = 1;
function uiScale(W, H) {
  const base = Math.min(W / 1600, H / 950);
  return Math.max(0.72, Math.min(2.4, base)) * _uiScaleOverride;
}
function setUiScale(v) { _uiScaleOverride = Math.max(0.6, Math.min(2.0, v)); }
function getUiScaleOverride() { return _uiScaleOverride; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCREEN, MENU_ITEMS, GlobeView, uiScale, setUiScale, wrapText };
}

// ── DEBRIEF ───────────────────────────────────────────────────
function drawDebrief(ctx, W, H, t, R, btns) {
  const U = uiScale(W, H);
  drawHero(ctx, W, H, t * 0.3, { alpha: 0.55 });
  ctx.fillStyle = 'rgba(3,9,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  btns.length = 0;
  if (!R) return;

  const ok = R.success;
  const col = ok ? '#4ef09a' : '#ff6b5e';
  const lx = W * 0.12;
  let y = H * 0.22;

  ctx.textAlign = 'left';
  ctx.fillStyle = col;
  ctx.font = `bold ${12 * U}px monospace`;
  setLS(ctx, `${4 * U}px`);
  ctx.fillText(ok ? 'MISSION COMPLETE' : 'MISSION FAILED', lx, y);
  setLS(ctx, '0px');
  y += 48 * U;
  ctx.fillStyle = '#e9f4ff';
  ctx.font = `bold ${46 * U}px monospace`;
  ctx.fillText(R.mission.name, lx, y);
  y += 24 * U;
  ctx.fillStyle = 'rgba(150,195,230,0.55)';
  ctx.font = `${13 * U}px monospace`;
  ctx.fillText(R.mission.subtitle, lx, y);
  y += 40 * U;

  ctx.strokeStyle = `rgba(${hexRgbS(col)},0.3)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + W * 0.42, y); ctx.stroke();
  y += 30 * U;

  // Objectives
  ctx.fillStyle = 'rgba(110,165,205,0.55)';
  ctx.font = `bold ${10 * U}px monospace`;
  setLS(ctx, `${2 * U}px`);
  ctx.fillText('OBJECTIVES', lx, y);
  setLS(ctx, '0px');
  y += 22 * U;
  for (const o of (R.scenario ? R.scenario.objectives : [])) {
    const c = o.done ? '#4ef09a' : o.optional ? 'rgba(150,180,205,0.4)' : '#ff8a7a';
    ctx.fillStyle = c;
    ctx.font = `${13 * U}px monospace`;
    ctx.fillText(o.done ? '✓' : '✗', lx, y);
    ctx.fillStyle = o.done ? 'rgba(215,238,250,0.85)' : 'rgba(190,200,210,0.5)';
    ctx.fillText(o.text, lx + 24 * U, y);
    if (o.progress) {
      ctx.fillStyle = 'rgba(140,185,215,0.5)';
      ctx.fillText(`${o.progress.cur}/${o.progress.max}`, lx + W * 0.34, y);
    }
    y += 24 * U;
  }
  y += 16 * U;

  // Stats
  const d = R.detail || {};
  const stats = [];
  if (d.killed !== undefined) stats.push(['DRONES DESTROYED', `${d.killed} / ${d.total ?? '?'}`]);
  if (d.leaked !== undefined) stats.push(['LEAKERS', String(d.leaked)]);
  if (d.recovered !== undefined) stats.push(['SURVIVOR', d.recovered ? 'RECOVERED' : 'LOST']);
  if (d.cellsSearched !== undefined) stats.push(['CELLS SEARCHED', String(d.cellsSearched)]);
  if (d.minutesLeft !== undefined) stats.push(['MARGIN', `${Math.round(d.minutesLeft)} min`]);
  if (d.time !== undefined) {
    const m = Math.floor(d.time / 60), sec = Math.floor(d.time % 60);
    stats.push(['ELAPSED', `${m}m ${String(sec).padStart(2,'0')}s`]);
  }
  if (ok && R.mission.payment) stats.push(['PAYMENT', `$${R.mission.payment.toLocaleString()}`]);

  let sx = lx;
  for (const [k, v] of stats) {
    ctx.fillStyle = 'rgba(110,160,200,0.5)';
    ctx.font = `${9 * U}px monospace`;
    ctx.fillText(k, sx, y);
    ctx.fillStyle = '#e8f2fa';
    ctx.font = `bold ${16 * U}px monospace`;
    ctx.fillText(v, sx, y + 24 * U);
    sx += 175 * U;
    if (sx > W * 0.62) { sx = lx; y += 52 * U; }
  }
  y += 76 * U;

  const bw = 300 * U, bh = 50 * U;
  const bl = 0.55 + Math.sin(t * 4) * 0.45;
  ctx.fillStyle = `rgba(${hexRgbS(col)},${0.10 + bl * 0.10})`;
  S_rrect(ctx, lx, y, bw, bh, 5 * U); ctx.fill();
  ctx.strokeStyle = `rgba(${hexRgbS(col)},${0.55 + bl * 0.35})`;
  ctx.lineWidth = 2;
  S_rrect(ctx, lx, y, bw, bh, 5 * U); ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = `bold ${15 * U}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('RETURN TO CHART  [ENTER]', lx + bw / 2, y + 31 * U);
  ctx.textAlign = 'left';
  btns.push({ x: lx, y, w: bw, h: bh, action: 'chart' });
}

// ── CREDITS / ATTRIBUTION ─────────────────────────────────────
// CC BY requires attribution. It belongs in the game, not in a
// text file nobody opens.
function drawCredits(ctx, W, H, t, btns) {
  const U = uiScale(W, H);
  drawHero(ctx, W, H, t * 0.25, { alpha: 0.4 });
  ctx.fillStyle = 'rgba(3,9,18,0.80)';
  ctx.fillRect(0, 0, W, H);
  btns.length = 0;

  const lx = W * 0.12;
  let y = H * 0.16;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4da6ff';
  ctx.font = `bold ${30 * U}px monospace`;
  setLS(ctx, `${3 * U}px`);
  ctx.fillText('CREDITS', lx, y);
  setLS(ctx, '0px');
  y += 52 * U;

  // ── MUSIC ──
  ctx.fillStyle = 'rgba(110,165,205,0.6)';
  ctx.font = `bold ${11 * U}px monospace`;
  setLS(ctx, `${2.5 * U}px`);
  ctx.fillText('MUSIC', lx, y);
  setLS(ctx, '0px');
  y += 12 * U;
  ctx.strokeStyle = 'rgba(70,140,190,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + W * 0.56, y); ctx.stroke();
  y += 30 * U;

  const tracks = MusicSys.attributions();
  if (!tracks.length) {
    ctx.fillStyle = 'rgba(110,150,185,0.4)';
    ctx.font = `${12 * U}px monospace`;
    ctx.fillText('No music tracks loaded.', lx, y);
    y += 26 * U;
  }
  for (const tr of tracks) {
    const playing = MusicSys.nowPlaying() === tr;
    if (playing) {
      ctx.fillStyle = 'rgba(74,166,255,0.08)';
      ctx.fillRect(lx - 14 * U, y - 22 * U, W * 0.58, 84 * U);
      ctx.fillStyle = '#4da6ff';
      ctx.fillRect(lx - 14 * U, y - 22 * U, 3 * U, 84 * U);
    }
    ctx.fillStyle = '#e9f4ff';
    ctx.font = `bold ${18 * U}px monospace`;
    ctx.fillText(tr.title, lx, y);
    if (playing) {
      ctx.fillStyle = 'rgba(78,240,154,0.7)';
      ctx.font = `${9 * U}px monospace`;
      ctx.fillText('◆ NOW PLAYING', lx + ctx.measureText(tr.title).width + 200 * U, y - 2 * U);
    }
    y += 22 * U;
    ctx.fillStyle = 'rgba(180,215,240,0.7)';
    ctx.font = `${13 * U}px monospace`;
    ctx.fillText(`Composed by ${tr.composer}`, lx, y);
    y += 19 * U;
    ctx.fillStyle = 'rgba(130,175,210,0.5)';
    ctx.font = `${11 * U}px monospace`;
    ctx.fillText(`Licence: ${tr.licence}`, lx, y);
    if (tr.licenceUrl) {
      ctx.fillStyle = 'rgba(110,155,195,0.4)';
      ctx.fillText(tr.licenceUrl, lx + 190 * U, y);
    }
    y += 17 * U;
    if (tr.source) {
      ctx.fillStyle = 'rgba(110,155,195,0.4)';
      ctx.font = `${10.5 * U}px monospace`;
      ctx.fillText(tr.source, lx, y);
      y += 17 * U;
    }
    y += 22 * U;
  }

  y += 14 * U;
  // ── SOUND ──
  ctx.fillStyle = 'rgba(110,165,205,0.6)';
  ctx.font = `bold ${11 * U}px monospace`;
  setLS(ctx, `${2.5 * U}px`);
  ctx.fillText('SOUND EFFECTS', lx, y);
  setLS(ctx, '0px');
  y += 12 * U;
  ctx.strokeStyle = 'rgba(70,140,190,0.25)';
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + W * 0.56, y); ctx.stroke();
  y += 26 * U;
  ctx.fillStyle = 'rgba(180,215,240,0.65)';
  ctx.font = `${12 * U}px monospace`;
  ctx.fillText('Synthesized live with the Web Audio API. No samples used.', lx, y);
  y += 34 * U;

  // ── REFERENCE ──
  ctx.fillStyle = 'rgba(110,165,205,0.6)';
  ctx.font = `bold ${11 * U}px monospace`;
  setLS(ctx, `${2.5 * U}px`);
  ctx.fillText('TECHNICAL REFERENCE', lx, y);
  setLS(ctx, '0px');
  y += 12 * U;
  ctx.strokeStyle = 'rgba(70,140,190,0.25)';
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + W * 0.56, y); ctx.stroke();
  y += 26 * U;
  ctx.fillStyle = 'rgba(150,190,220,0.55)';
  ctx.font = `${11 * U}px monospace`;
  [
    'Coastlines projected from real latitude and longitude.',
    'Radar horizon derived from geometry, not assigned as a stat.',
    'Ship performance and magazine loadout from published figures.',
    'This is a work of fiction. DDG-144 does not exist.'
  ].forEach(l => { ctx.fillText(l, lx, y); y += 18 * U; });

  // Back
  y += 26 * U;
  const bw = 220 * U, bh = 44 * U;
  const bl = 0.5 + Math.sin(t * 4) * 0.4;
  ctx.fillStyle = `rgba(74,166,255,${0.08 + bl * 0.08})`;
  S_rrect(ctx, lx, y, bw, bh, 4 * U); ctx.fill();
  ctx.strokeStyle = `rgba(74,166,255,${0.45 + bl * 0.3})`;
  ctx.lineWidth = 1.5;
  S_rrect(ctx, lx, y, bw, bh, 4 * U); ctx.stroke();
  ctx.fillStyle = '#7cc4ff';
  ctx.font = `bold ${13 * U}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('BACK  [ESC]', lx + bw / 2, y + 28 * U);
  ctx.textAlign = 'left';
  btns.push({ x: lx, y, w: bw, h: bh, id: 'backmenu' });
}

// Small now-playing readout for the menu
function drawNowPlaying(ctx, W, H, U) {
  const tr = MusicSys.nowPlaying();
  if (!tr) return;
  const x = W - 30 * U, y = H - 74 * U;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(110,155,195,0.35)';
  ctx.font = `${9 * U}px monospace`;
  ctx.fillText('♪  NOW PLAYING', x, y);
  ctx.fillStyle = 'rgba(160,200,235,0.5)';
  ctx.font = `${10.5 * U}px monospace`;
  ctx.fillText(`${tr.title} — ${tr.composer}`, x, y + 15 * U);
  ctx.fillStyle = 'rgba(100,140,175,0.28)';
  ctx.font = `${8.5 * U}px monospace`;
  ctx.fillText(tr.licence, x, y + 28 * U);
  ctx.restore();
  ctx.textAlign = 'left';
}

// ── SHIP'S LOG VIEWER ─────────────────────────────────────────
// The sabotage has to be findable, not announced. This is where
// the player can go back and look.
function drawShipLog(ctx, W, H, t, log, scroll, btns) {
  const U = uiScale(W, H);
  drawHero(ctx, W, H, t * 0.2, { alpha: 0.35 });
  ctx.fillStyle = 'rgba(3,9,18,0.88)';
  ctx.fillRect(0, 0, W, H);
  btns.length = 0;
  if (!log) return;

  const lx = W * 0.10, rw = W * 0.62;
  let y = H * 0.11;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4da6ff';
  ctx.font = `bold ${26 * U}px monospace`;
  setLS(ctx, `${3 * U}px`);
  ctx.fillText("SHIP'S LOG", lx, y);
  setLS(ctx, '0px');
  ctx.fillStyle = 'rgba(140,185,220,0.45)';
  ctx.font = `${11 * U}px monospace`;
  ctx.fillText('DDG-144  ·  MAINTENANCE AND SYSTEM ACCESS', lx + 200 * U, y);
  y += 30 * U;

  if (log.revealed) {
    ctx.fillStyle = 'rgba(255,80,60,0.8)';
    ctx.font = `bold ${11 * U}px monospace`;
    ctx.fillText('⚠  ONE ENTRY FLAGGED — CROSS-REFERENCED WITH FAULT RECORD', lx, y);
    y += 22 * U;
  } else if (log.suspicion > 0) {
    ctx.fillStyle = 'rgba(255,190,60,0.6)';
    ctx.font = `${10 * U}px monospace`;
    ctx.fillText(`${log.suspicion} fault${log.suspicion>1?'s':''} recorded this deployment.`, lx, y);
    y += 20 * U;
  }

  ctx.strokeStyle = 'rgba(70,140,190,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + rw, y); ctx.stroke();
  y += 20 * U;

  // Scrollable list
  const listTop = y, listBottom = H - 90 * U;
  ctx.save();
  ctx.beginPath();
  ctx.rect(lx - 20 * U, listTop - 10 * U, rw + 40 * U, listBottom - listTop + 10 * U);
  ctx.clip();
  y -= scroll;

  for (const e of log.entries) {
    if (y > listBottom + 60 * U) break;
    const cat = LOG_CATEGORY[e.cat] || LOG_CATEGORY.MAINT;
    const flagged = log.revealed && e.sabotage;
    const isFault = e.fault || e.cat === 'FAULT';

    if (y > listTop - 70 * U) {
      if (flagged) {
        ctx.fillStyle = 'rgba(255,60,40,0.10)';
        ctx.fillRect(lx - 12 * U, y - 14 * U, rw + 24 * U, 62 * U);
        ctx.fillStyle = '#ff5a48';
        ctx.fillRect(lx - 12 * U, y - 14 * U, 3 * U, 62 * U);
      } else if (isFault) {
        ctx.fillStyle = 'rgba(255,160,60,0.05)';
        ctx.fillRect(lx - 12 * U, y - 14 * U, rw + 24 * U, 56 * U);
      }

      // Date
      ctx.fillStyle = 'rgba(110,150,185,0.5)';
      ctx.font = `${9 * U}px monospace`;
      const d = e.stamp ? e.stamp
              : e.day === null ? '—'
              : e.day === 0 ? 'DEPARTURE'
              : `D${e.day}`;
      ctx.fillText(d, lx, y);

      // Category
      ctx.fillStyle = flagged ? '#ff5a48' : cat.col;
      ctx.font = `bold ${9 * U}px monospace`;
      ctx.fillText(cat.label, lx + 90 * U, y);

      // Who
      ctx.fillStyle = 'rgba(150,185,215,0.55)';
      ctx.font = `${9 * U}px monospace`;
      ctx.fillText(e.who, lx + 210 * U, y);

      if (flagged) {
        ctx.fillStyle = '#ff5a48';
        ctx.font = `bold ${8.5 * U}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText('◆ FLAGGED', lx + rw, y);
        ctx.textAlign = 'left';
      }
      y += 15 * U;

      // Body
      ctx.fillStyle = flagged ? 'rgba(255,190,180,0.9)' : 'rgba(200,225,245,0.72)';
      ctx.font = `${10 * U}px monospace`;
      y = wrapText(ctx, e.text, lx, y, rw, 14 * U);
      y += 14 * U;
    } else {
      // Off-screen above — still advance by an estimate
      ctx.font = `${10 * U}px monospace`;
      y += 15 * U + countWrappedS(ctx, e.text, rw) * 14 * U + 14 * U;
    }
  }
  ctx.restore();

  // Scroll hint
  ctx.fillStyle = 'rgba(110,150,185,0.35)';
  ctx.font = `${9 * U}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('WHEEL / ↑↓ SCROLL   ·   ESC BACK', lx, H - 56 * U);

  // Side panel — evidence summary once faults exist
  if (log.suspicion > 0 || log.revealed) {
    const px = lx + rw + 40 * U, pw = W - px - W * 0.06;
    let py2 = H * 0.20;
    ctx.fillStyle = 'rgba(6,18,32,0.92)';
    ctx.fillRect(px, py2 - 24 * U, pw, 240 * U);
    ctx.strokeStyle = log.revealed ? 'rgba(255,80,60,0.4)' : 'rgba(255,190,60,0.3)';
    ctx.strokeRect(px, py2 - 24 * U, pw, 240 * U);
    ctx.fillStyle = log.revealed ? '#ff5a48' : 'rgba(255,190,60,0.75)';
    ctx.font = `bold ${10 * U}px monospace`;
    ctx.fillText(log.revealed ? 'CONCLUSION' : 'OPEN QUESTIONS', px + 14 * U, py2 - 4 * U);
    py2 += 16 * U;
    ctx.fillStyle = 'rgba(190,215,240,0.7)';
    ctx.font = `${9.5 * U}px monospace`;
    const lines = log.revealed
      ? ['The CIWS reported READY and did not engage.',
         '',
         'A firmware package six days before departure ' +
         'touched the fire-control interlock.',
         '',
         'It was signed by Spearpoint Technical Services ' +
         'on a visit that is not on the transfer schedule.']
      : ['A system reported ready and did not fire.',
         '',
         'The self-test faults on D-4 were attributed to ' +
         'the new software baseline.',
         '',
         'Nobody has checked whether that was true.'];
    for (const l of lines) {
      if (l === '') { py2 += 8 * U; continue; }
      py2 = wrapText(ctx, l, px + 14 * U, py2, pw - 28 * U, 13 * U);
    }
  }
}

function countWrappedS(ctx, text, maxW) {
  const words = String(text || '').split(' ');
  let line = '', n = 1;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) { n++; line = w + ' '; }
    else line = test;
  }
  return n;
}

// ── SABOTAGE REVEAL SCREEN ────────────────────────────────────
function drawReveal(ctx, W, H, t, phase, btns) {
  const U = uiScale(W, H);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = scanPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  btns.length = 0;

  const lx = W * 0.12, rw = W * 0.62;
  let y = H * 0.16;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff5a48';
  ctx.font = `bold ${12 * U}px monospace`;
  setLS(ctx, `${4 * U}px`);
  ctx.fillText(SABOTAGE_REVEAL.title, lx, y);
  setLS(ctx, '0px');
  y += 46 * U;

  const blocks = [
    { lines: SABOTAGE_REVEAL.findings,    col: 'rgba(220,238,250,0.88)' },
    { lines: SABOTAGE_REVEAL.implication, col: 'rgba(255,190,110,0.85)' },
    { lines: SABOTAGE_REVEAL.irony,       col: 'rgba(255,120,100,0.9)' }
  ];
  const show = Math.min(blocks.length, phase + 1);
  ctx.font = `${13 * U}px monospace`;
  for (let i = 0; i < show; i++) {
    ctx.fillStyle = blocks[i].col;
    for (const l of blocks[i].lines) {
      if (l === '') { y += 10 * U; continue; }
      y = wrapText(ctx, l, lx, y, rw, 20 * U);
    }
    y += 26 * U;
  }

  const bl = 0.4 + Math.sin(t * 4) * 0.4;
  ctx.fillStyle = `rgba(200,225,245,${bl})`;
  ctx.font = `${11 * U}px monospace`;
  ctx.fillText(show < blocks.length ? 'CONTINUE  ▸' : 'ENTER — RETURN', lx, H - 70 * U);
}

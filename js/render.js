// ═══════════════════════════════════════════════════════════════
//  RENDER — camera, terrain, bathymetry, tactical overlays
// ═══════════════════════════════════════════════════════════════

class Camera {
  constructor() {
    this.x = 0; this.y = 0;      // centre in nm
    this.pxPerNm = 14;           // zoom
    this.targetPxPerNm = 14;
    this.follow = true;
  }
  get minZoom() { return 6; }
  get maxZoom() { return 2600; }

  zoomBy(f, anchorX, anchorY, W, H) {
    const old = this.pxPerNm;
    this.targetPxPerNm = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetPxPerNm * f));
    // Zoom toward cursor
    if (anchorX !== undefined) {
      const wx = this.sx2nm(anchorX, W);
      const wy = this.sy2nm(anchorY, H);
      const k = 1 - old / this.targetPxPerNm;
      this.x += (wx - this.x) * k * 0.55;
      this.y += (wy - this.y) * k * 0.55;
    }
  }
  update(dt) {
    // Smooth zoom easing
    const d = this.targetPxPerNm / this.pxPerNm;
    if (Math.abs(Math.log(d)) > 0.001) {
      this.pxPerNm *= Math.pow(d, Math.min(1, dt * 9));
    } else this.pxPerNm = this.targetPxPerNm;
  }
  nm2sx(nx, W) { return (nx - this.x) * this.pxPerNm + W / 2; }
  nm2sy(ny, H) { return (ny - this.y) * this.pxPerNm + H / 2; }
  sx2nm(sx, W) { return (sx - W / 2) / this.pxPerNm + this.x; }
  sy2nm(sy, H) { return (sy - H / 2) / this.pxPerNm + this.y; }

  // Zoom tier name for HUD
  get tier() {
    if (this.pxPerNm < LOD_SYMBOL) return 'STRATEGIC';
    if (this.pxPerNm < LOD_DETAIL) return 'TACTICAL';
    return 'DETAIL';
  }
  // Visible width in nm
  widthNm(W) { return W / this.pxPerNm; }
}

// ── OCEAN & BATHYMETRY ────────────────────────────────────────
// Pre-rendered depth field, cached to an offscreen canvas.
let bathyCanvas = null;
let bathyRes = 0;

function buildBathymetry() {
  const res = 3.2; // px per nm in the cached layer
  const w = Math.ceil(MAP_W * res), h = Math.ceil(MAP_H * res);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c2 = cv.getContext('2d');
  const img = c2.createImageData(w, h);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / res, ny = py / res;
      const i = (py * w + px) * 4;
      if (isLand(nx, ny)) {
        img.data[i] = 0; img.data[i+1] = 0; img.data[i+2] = 0; img.data[i+3] = 0;
        continue;
      }
      const d = depthAt(nx, ny);           // 0..80 m
      const tt = Math.min(1, d / 80);
      // Shallow: teal-green.  Deep: dark navy.
      const r = Math.round(10 + (1 - tt) * 22);
      const g = Math.round(38 + (1 - tt) * 78);
      const b = Math.round(62 + (1 - tt) * 58);
      img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
    }
  }
  c2.putImageData(img, 0, 0);
  bathyCanvas = cv; bathyRes = res;
}

function drawOcean(ctx, cam, W, H, time) {
  // Base deep water
  ctx.fillStyle = '#071a2e';
  ctx.fillRect(0, 0, W, H);

  if (!bathyCanvas) buildBathymetry();

  // Blit the cached bathymetry, scaled to current camera
  const sx = cam.nm2sx(0, W), sy = cam.nm2sy(0, H);
  const dw = MAP_W * cam.pxPerNm, dh = MAP_H * cam.pxPerNm;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bathyCanvas, sx, sy, dw, dh);

  // Animated surface texture — only when zoomed in enough to matter
  if (cam.pxPerNm > 40) {
    const alpha = Math.min(0.05, (cam.pxPerNm - 40) / 2400);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#9fd8f0';
    ctx.lineWidth = 1;
    const spacing = Math.max(24, cam.pxPerNm * 0.06);
    const off = (time * 6) % spacing;
    for (let y = -spacing + off; y < H + spacing; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 28) {
        const yy = y + Math.sin((x * 0.011) + time * 0.5) * 3.2;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── LAND ──────────────────────────────────────────────────────
function drawLand(ctx, cam, W, H) {
  for (const L of LAND_NM) {
    const pts = L.pts;
    // Cull if entirely offscreen
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) {
      const x = cam.nm2sx(p.x, W), y = cam.nm2sy(p.y, H);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (maxX < -60 || minX > W + 60 || maxY < -60 || minY > H + 60) continue;

    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = cam.nm2sx(p.x, W), y = cam.nm2sy(p.y, H);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Surf / shallow halo around the coast
    ctx.save();
    ctx.shadowColor = 'rgba(120,210,235,0.5)';
    ctx.shadowBlur = Math.min(26, 5 + cam.pxPerNm * 0.10);
    ctx.fillStyle = '#3a3628';
    ctx.fill();
    ctx.restore();

    // Terrain fill with elevation gradient
    const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
    g.addColorStop(0, '#4a4433');
    g.addColorStop(0.45, '#3d3829');
    g.addColorStop(1, '#332f22');
    ctx.fillStyle = g;
    ctx.fill();

    // Coastline
    ctx.strokeStyle = 'rgba(190,180,140,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Mountain peaks (Musandam is dramatic)
    if (cam.pxPerNm > 12 && L.peaks) {
      ctx.save();
      ctx.clip();
      for (const pk of L.peaks) {
        const x = cam.nm2sx(pk.x, W), y = cam.nm2sy(pk.y, H);
        const R = cam.pxPerNm * 3.2;
        const rg = ctx.createRadialGradient(x - R*0.2, y - R*0.2, 0, x, y, R);
        rg.addColorStop(0, 'rgba(122,112,84,0.75)');
        rg.addColorStop(0.5, 'rgba(80,74,56,0.35)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // Country label
    if (cam.pxPerNm > 9 && cam.pxPerNm < 300) {
      const lx = cam.nm2sx(L.label.x, W), ly = cam.nm2sy(L.label.y, H);
      if (lx > -100 && lx < W + 100 && ly > 0 && ly < H) {
        ctx.save();
        ctx.fillStyle = 'rgba(215,205,170,0.42)';
        ctx.font = `${Math.min(16, 8 + cam.pxPerNm * 0.09)}px monospace`;
        ctx.textAlign = 'center';
        ctx.letterSpacing = '2px';
        ctx.fillText(L.name, lx, ly);
        if (L.country && cam.pxPerNm > 14) {
          ctx.fillStyle = 'rgba(215,205,170,0.26)';
          ctx.font = `${Math.min(11, 6 + cam.pxPerNm * 0.05)}px monospace`;
          ctx.fillText(L.country, lx, ly + 15);
        }
        ctx.restore();
      }
    }
  }
}

// ── TRAFFIC SEPARATION SCHEME ─────────────────────────────────
function drawTSS(ctx, cam, W, H) {
  if (cam.pxPerNm < 8) return;
  const lanes = [
    { pts: TSS_NM.inbound,  col: 'rgba(120,190,255,0.16)', label: 'INBOUND LANE' },
    { pts: TSS_NM.outbound, col: 'rgba(255,190,120,0.16)', label: 'OUTBOUND LANE' }
  ];
  const halfW = TSS_NM.laneWidth / 2 * cam.pxPerNm;
  for (const L of lanes) {
    ctx.save();
    ctx.strokeStyle = L.col;
    ctx.lineWidth = halfW * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    L.pts.forEach((p, i) => {
      const x = cam.nm2sx(p.x, W), y = cam.nm2sy(p.y, H);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Centreline
    ctx.strokeStyle = L.col.replace('0.16', '0.4');
    ctx.lineWidth = 1;
    ctx.setLineDash([9, 9]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ── RANGE RINGS ───────────────────────────────────────────────
function drawRangeRings(ctx, cam, W, H, cx, cy, rings) {
  const sx = cam.nm2sx(cx, W), sy = cam.nm2sy(cy, H);
  for (const r of rings) {
    const rad = r.nm * cam.pxPerNm;
    if (rad < 12 || rad > Math.max(W, H) * 3.5) continue;
    ctx.save();
    ctx.strokeStyle = r.col;
    ctx.lineWidth = r.width || 1;
    if (r.dash) ctx.setLineDash(r.dash);
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label at the top of the ring
    if (r.label && rad > 40) {
      ctx.fillStyle = r.col;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const ly = sy - rad;
      if (ly > 30 && ly < H - 10) {
        ctx.fillStyle = 'rgba(4,12,24,0.85)';
        const tw = ctx.measureText(r.label).width;
        ctx.fillRect(sx - tw/2 - 5, ly - 10, tw + 10, 14);
        ctx.fillStyle = r.col;
        ctx.fillText(r.label, sx, ly + 1);
      }
    }
    ctx.restore();
  }
}

// ── LAT/LON GRATICULE ─────────────────────────────────────────
function drawGraticule(ctx, cam, W, H) {
  if (cam.pxPerNm < 5) return;
  // Choose spacing so lines aren't too dense
  let stepMin = 30; // arc-minutes
  const pxPerMin = cam.pxPerNm * (NM_PER_DEG_LAT / 60);
  if (pxPerMin > 55) stepMin = 5;
  else if (pxPerMin > 22) stepMin = 10;
  else if (pxPerMin > 9) stepMin = 20;

  ctx.save();
  ctx.strokeStyle = 'rgba(90,150,190,0.10)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(120,180,220,0.32)';
  ctx.font = '9px monospace';

  const tl = nm2ll(cam.sx2nm(0, W), cam.sy2nm(0, H));
  const br = nm2ll(cam.sx2nm(W, W), cam.sy2nm(H, H));

  const latStart = Math.floor(br.lat * 60 / stepMin) * stepMin;
  const latEnd   = Math.ceil(tl.lat * 60 / stepMin) * stepMin;
  for (let m = latStart; m <= latEnd; m += stepMin) {
    const lat = m / 60;
    const p = ll2nm(lat, GEO_ORIGIN.lon);
    const y = cam.nm2sy(p.y, H);
    if (y < 0 || y > H) continue;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    const d = Math.floor(lat), mm = Math.round((lat - d) * 60);
    ctx.textAlign = 'left';
    ctx.fillText(`${d}°${String(mm).padStart(2,'0')}'N`, 6, y - 4);
  }

  const lonStart = Math.floor(tl.lon * 60 / stepMin) * stepMin;
  const lonEnd   = Math.ceil(br.lon * 60 / stepMin) * stepMin;
  for (let m = lonStart; m <= lonEnd; m += stepMin) {
    const lon = m / 60;
    const p = ll2nm(GEO_ORIGIN.lat, lon);
    const x = cam.nm2sx(p.x, W);
    if (x < 0 || x > W) continue;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    const d = Math.floor(lon), mm = Math.round((lon - d) * 60);
    ctx.textAlign = 'center';
    ctx.fillText(`${d}°${String(mm).padStart(2,'0')}'E`, x, 12);
  }
  ctx.restore();
}

// ── WAKE ──────────────────────────────────────────────────────
function drawWake(ctx, cam, W, H, ship) {
  if (ship.wake.length < 2) return;
  ctx.save();
  for (let i = ship.wake.length - 1; i >= 0; i--) {
    const w = ship.wake[i];
    const x = cam.nm2sx(w.x, W), y = cam.nm2sy(w.y, H);
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
    const life = 1 - w.age / 240;
    const spread = (1 - life) * 0.9 + 0.15;
    const r = Math.max(1, spread * cam.pxPerNm * 0.035 * (w.spd / 20 + 0.5));
    ctx.fillStyle = `rgba(170,220,245,${life * 0.20})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── SCALE BAR ─────────────────────────────────────────────────
function drawScaleBar(ctx, cam, W, H, x, y) {
  // Pick a "nice" distance that renders 80-200px
  const nice = [0.1,0.25,0.5,1,2,5,10,20,50,100];
  let pick = nice[0];
  for (const n of nice) { if (n * cam.pxPerNm <= 190) pick = n; }
  const px = pick * cam.pxPerNm;
  ctx.save();
  ctx.strokeStyle = 'rgba(200,225,245,0.65)';
  ctx.fillStyle = 'rgba(200,225,245,0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5);
  ctx.stroke();
  ctx.font = '10px monospace'; ctx.textAlign = 'center';
  const lbl = pick < 1 ? `${(pick*2000).toFixed(0)} yd` : `${pick} nm`;
  ctx.fillText(lbl, x + px / 2, y - 8);
  ctx.restore();
}

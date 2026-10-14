// ═══════════════════════════════════════════════════════════════
//  WEAPONS — engagement framework, projectiles, intercepts
// ═══════════════════════════════════════════════════════════════

// Illuminator-limited simultaneous engagements (real ship: 3x AN/SPG-62)
const SALVO_CAP_SEMIACTIVE = 4;   // set to 3 for strict realism
const SALVO_CAP_ACTIVE     = 8;   // SM-6 is fire-and-forget
const HOVER_LOCK_TIME      = 0.5; // seconds of hover to designate

// Mach 1 at sea level ≈ 661 knots
const MACH = 661;

// ── WEAPON PROFILES (engagement data) ─────────────────────────
const ENGAGE = {
  sm2:  { short:'SM-2',  speedKts: 3.5*MACH, rangeNm: 90,  pk: 0.70, seeker:'semi',   col:'#5ac8fa', vls:true,  role:'AAW' },
  sm6:  { short:'SM-6',  speedKts: 3.5*MACH, rangeNm: 130, pk: 0.82, seeker:'active', col:'#64d2ff', vls:true,  role:'AAW' },
  essm: { short:'ESSM',  speedKts: 4.0*MACH, rangeNm: 27,  pk: 0.75, seeker:'semi',   col:'#30d158', vls:true,  role:'PD'  },
  gun:  { short:'5in',   speedKts: 1600,     rangeNm: 13,  pk: 0.28, seeker:'ballistic', col:'#ffd60a', vls:false, role:'GUN' },
  ciws: { short:'CIWS',  speedKts: 2200,     rangeNm: 1.0, pk: 0.55, seeker:'ballistic', col:'#ff453a', vls:false, role:'PD' },

  // Strike and ASW weapons. These do not engage inbound missiles —
  // they are aimed at a POINT ON THE CHART, so they use a different
  // designation mode entirely.
  tomahawk: { short:'TLAM', speedKts: 0.74*MACH, rangeNm: 900, pk: 0.92,
              seeker:'inertial', col:'#ff9f0a', vls:true, role:'STRIKE',
              mode:'point', salvoCap: 4, flightMult: 1.0 },
  asroc:    { short:'ASROC', speedKts: 1.0*MACH, rangeNm: 12, pk: 0.60,
              seeker:'ballistic', col:'#bf5af2', vls:true, role:'ASW',
              mode:'point', salvoCap: 2, flightMult: 1.0 },
  torpedo:  { short:'Mk 54', speedKts: 40,       rangeNm: 5,  pk: 0.65,
              seeker:'sonar', col:'#5e5ce6', vls:false, role:'ASW',
              mode:'point', salvoCap: 2, flightMult: 1.0 }
};

function salvoCapFor(wk) {
  const w = ENGAGE[wk];
  if (!w) return 1;
  if (w.seeker === 'active') return SALVO_CAP_ACTIVE;
  if (w.seeker === 'ballistic') return 1;
  return SALVO_CAP_SEMIACTIVE;
}

// ── INBOUND THREAT ────────────────────────────────────────────
class Threat {
  constructor(x, y, tx, ty, opts = {}) {
    this.x = x; this.y = y;
    this.tx = tx; this.ty = ty;          // aim point
    this.speedKts = opts.speedKts || 0.9 * MACH;
    this.altM = opts.altM || 5;          // sea-skimmer
    this.name = opts.name || 'VAMPIRE';
    this.airframe = opts.airframe || null;   // 'drone' etc, for rendering
    this.dead = false;
    this.impacted = false;
    this.detected = false;
    this.trackNum = null;
    this.trail = [];
    this.id = Threat._id = (Threat._id || 0) + 1;
    this.engagedBy = 0;                  // count of interceptors assigned
    this.hdg = (Math.atan2(tx - x, -(ty - y)) * 180 / Math.PI + 360) % 360;
    this._tacc = 0;
  }

  get mach() { return this.speedKts / MACH; }

  update(dt, targetShip) {
    if (this.dead) return;
    // Re-aim at ownship continuously
    if (targetShip) { this.tx = targetShip.x; this.ty = targetShip.y; }
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = (this.speedKts / 3600) * dt;
    // Impact threshold must exceed the per-tick step, or a fast
    // missile at high time compression steps straight past the
    // ship, re-aims, and oscillates forever without ever hitting.
    if (dist < Math.max(0.02, step * 1.5)) {
      this.impacted = true; this.dead = true; return;
    }
    this.hdg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;

    this._tacc += dt;
    if (this._tacc > 0.35) {
      this._tacc = 0;
      this.trail.push({ x: this.x, y: this.y, age: 0 });
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age += dt;
      if (this.trail[i].age > 14) this.trail.splice(i, 1);
    }
  }

  // Time to impact in seconds
  ttiSec(ship) {
    const d = Math.hypot(ship.x - this.x, ship.y - this.y);
    return d / (this.speedKts / 3600);
  }
}

// ── INTERCEPTOR / OUTBOUND ROUND ──────────────────────────────
const PHASE = { BOOST: 0, PITCH: 1, CRUISE: 2, DONE: 3 };

class Interceptor {
  constructor(ship, target, wk) {
    this.x = ship.x; this.y = ship.y;
    this.target = target;
    this.wk = wk;
    const E = ENGAGE[wk];
    this.speedKts = E.speedKts;
    this.pk = E.pk;
    this.col = E.col;
    this.isVLS = E.vls;
    this.phase = this.isVLS ? PHASE.BOOST : PHASE.CRUISE;
    this.t = 0;
    this.alt = 0;              // visual: 0..1 climb factor during boost
    this.hdg = ship.hdg;
    this.trail = [];
    this.smoke = [];
    this.dead = false;
    this.result = null;        // 'HIT' | 'MISS'
    this.launchX = ship.x; this.launchY = ship.y;
    this._sacc = 0;
    // Which VLS cell it came from (visual offset on deck)
    this.cellOff = (Math.random() - 0.5) * 0.012;
    this.id = Interceptor._id = (Interceptor._id || 0) + 1;
  }

  update(dt) {
    if (this.dead) return;
    this.t += dt;

    if (this.phase === PHASE.BOOST) {
      // Vertical climb — almost no lateral movement
      this.alt = Math.min(1, this.t / 1.2);
      this._emitSmoke(dt, 0.9);
      if (this.t >= 1.2) { this.phase = PHASE.PITCH; }
      return;
    }

    if (this.phase === PHASE.PITCH) {
      // Tip over toward the bearing
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const want = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      let err = want - this.hdg;
      while (err > 180) err -= 360;
      while (err < -180) err += 360;
      this.hdg += err * Math.min(1, dt * 6);
      this._emitSmoke(dt, 0.7);
      if (this.t >= 1.5) this.phase = PHASE.CRUISE;
      return;
    }

    // CRUISE — proportional navigation with lead
    if (this.target.dead) { this.dead = true; this.result = 'MISS'; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Intercept point: lead the target
    const closing = this.speedKts + (this.target.speedKts || 0);
    const tLead = dist / (closing / 3600);
    const trad = (this.target.hdg || 0) * Math.PI / 180;
    const lx = this.target.x + Math.sin(trad) * (this.target.speedKts || 0) / 3600 * tLead;
    const ly = this.target.y - Math.cos(trad) * (this.target.speedKts || 0) / 3600 * tLead;
    const ax = lx - this.x, ay = ly - this.y;
    const adist = Math.hypot(ax, ay) || 1;

    const want = (Math.atan2(ax, -ay) * 180 / Math.PI + 360) % 360;
    let err = want - this.hdg;
    while (err > 180) err -= 360;
    while (err < -180) err += 360;
    this.hdg += err * Math.min(1, dt * 3.2);

    const step = (this.speedKts / 3600) * dt;
    const rad = this.hdg * Math.PI / 180;
    this.x += Math.sin(rad) * step;
    this.y -= Math.cos(rad) * step;

    this._emitSmoke(dt, 0.45);

    // Intercept check
    if (dist < Math.max(0.05, step * 1.4)) {
      this.dead = true;
      const hit = Math.random() < this.pk;
      this.result = hit ? 'HIT' : 'MISS';
      if (hit) this.target.dead = true;
      return;
    }
    // Self-destruct if it overshoots badly
    if (this.t > 200) { this.dead = true; this.result = 'MISS'; }
  }

  _emitSmoke(dt, density) {
    this._sacc += dt;
    const iv = 0.06 / Math.max(0.2, density);
    while (this._sacc > iv) {
      this._sacc -= iv;
      this.smoke.push({
        x: this.x + (Math.random() - 0.5) * 0.004,
        y: this.y + (Math.random() - 0.5) * 0.004,
        age: 0,
        r0: 0.0025 + Math.random() * 0.0035,
        drift: (Math.random() - 0.5) * 0.0006
      });
    }
  }
}

// Standalone drifting smoke that outlives its missile
class SmokeField {
  constructor() { this.puffs = []; }
  absorb(list) {
    for (const p of list) this.puffs.push(p);
    list.length = 0;
  }
  update(dt) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      p.x += p.drift * dt;
      p.y += p.drift * 0.4 * dt;
      if (p.age > 26) this.puffs.splice(i, 1);
    }
    // Hard cap for performance
    if (this.puffs.length > 2600) this.puffs.splice(0, this.puffs.length - 2600);
  }
}

// ── FIRING SOLUTION ───────────────────────────────────────────
class FireControl {
  constructor(ship) {
    this.ship = ship;
    this.weapon = null;          // selected weapon key
    this.locked = [];            // designated Threat objects
    this.hoverTarget = null;
    this.hoverTime = 0;
    this.doubleSalvo = false;    // shoot-shoot doctrine
    this.interceptors = [];
    this.smokeField = new SmokeField();
    this.blasts = [];
    this.log = [];
  }

  get cap() { return this.weapon ? salvoCapFor(this.weapon) : 0; }
  get full() { return this.locked.length >= this.cap; }

  selectWeapon(wk) {
    if (this.weapon === wk) { this.weapon = null; this.locked = []; return; }
    this.weapon = wk;
    this.locked = [];
  }

  // Called each frame with whatever the cursor is over
  updateHover(threat, dt) {
    if (!this.weapon) { this.hoverTarget = null; this.hoverTime = 0; return null; }
    if (!threat || threat.dead) { this.hoverTarget = null; this.hoverTime = 0; return null; }
    if (this.locked.includes(threat)) { this.hoverTarget = null; this.hoverTime = 0; return null; }
    if (this.full) return null;

    if (this.hoverTarget !== threat) {
      this.hoverTarget = threat;
      this.hoverTime = 0;
    }
    this.hoverTime += dt;
    if (this.hoverTime >= HOVER_LOCK_TIME) {
      this.locked.push(threat);
      this.hoverTarget = null;
      this.hoverTime = 0;
      return 'LOCKED';
    }
    return null;
  }

  unlock(threat) {
    const i = this.locked.indexOf(threat);
    if (i >= 0) this.locked.splice(i, 1);
  }
  clear() { this.locked = []; this.hoverTarget = null; this.hoverTime = 0; }

  // Returns array of log strings
  fire(mag) {
    if (!this.weapon || !this.locked.length) return ['No firing solution.'];
    const wk = this.weapon;
    const E = ENGAGE[wk];
    const rounds = this.doubleSalvo ? 2 : 1;
    const out = [];

    // Ammo source
    const src = mag.weapons[wk] || (wk === 'gun' ? mag.gun : wk === 'ciws' ? mag.ciws : null);
    if (!src) return ['Weapon unavailable.'];

    let fired = 0;
    for (const tgt of this.locked) {
      if (tgt.dead) continue;
      for (let r = 0; r < rounds; r++) {
        const avail = (wk === 'gun' || wk === 'ciws') ? src.rounds : src.count;
        if (avail <= 0) {
          out.push(`${E.short} MAGAZINE EMPTY`);
          if (typeof Audio !== 'undefined' && Audio.dryFire) Audio.dryFire();
          break;
        }
        if (wk === 'gun' || wk === 'ciws') src.rounds--; else src.count--;
        const ic = new Interceptor(this.ship, tgt, wk);
        // Stagger the second round slightly
        ic.t = -r * 0.9;
        this.interceptors.push(ic);
        tgt.engagedBy++;
        fired++;
        // Launch audio — staggered so a 4-salvo sounds like a ripple
        if (typeof Audio !== 'undefined' && Audio.vlsLaunch) {
          const d = (fired - 1) * 0.16 + r * 0.9;
          if (wk === 'gun') Audio.gunFire();
          else if (wk === 'ciws') Audio.ciwsBurst();
          else Audio.vlsLaunch(d);
        }
      }
    }
    if (fired > 0 && typeof Audio !== 'undefined' && Audio.fireCommand) Audio.fireCommand();
    out.unshift(`${E.short} SALVO AWAY — ${fired} round${fired !== 1 ? 's' : ''} at ${this.locked.length} target${this.locked.length !== 1 ? 's' : ''}${rounds === 2 ? ' (DOUBLE)' : ''}`);
    this.clear();
    return out;
  }

  update(dt) {
    for (let i = this.interceptors.length - 1; i >= 0; i--) {
      const ic = this.interceptors[i];
      if (ic.t < 0) { ic.t += dt; continue; }  // launch delay
      ic.update(dt);
      // Move its smoke into the persistent field
      if (ic.smoke.length > 40) this.smokeField.absorb(ic.smoke);
      if (ic.dead) {
        this.smokeField.absorb(ic.smoke);
        if (ic.result === 'HIT') {
          this.blasts.push({ x: ic.x, y: ic.y, age: 0, max: 2.2, big: true });
        } else {
          this.blasts.push({ x: ic.x, y: ic.y, age: 0, max: 1.1, big: false });
        }
        this.interceptors.splice(i, 1);
      }
    }
    this.smokeField.update(dt);
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].age += dt;
      if (this.blasts[i].age >= this.blasts[i].max) this.blasts.splice(i, 1);
    }
    // Drop dead locks
    this.locked = this.locked.filter(t => !t.dead);
  }
}

// ── THREAT MANAGER ────────────────────────────────────────────
class ThreatBoard {
  constructor(ship) {
    this.ship = ship;
    this.threats = [];
    this.nextTrack = 9001;
    this.alarm = false;
    this.alarmT = 0;
    this.leakers = 0;
    this.killed = 0;
  }

  spawnWave(count, opts = {}) {
    const brgBase = opts.bearing !== undefined ? opts.bearing : Math.random() * 360;
    const spread = opts.spread || 55;
    const rangeNm = opts.rangeNm || 24;
    const mach = opts.mach || 0.9;
    const stagger = opts.stagger || 2.0;
    const made = [];
    for (let i = 0; i < count; i++) {
      const brg = brgBase + (Math.random() - 0.5) * spread;
      const rad = brg * Math.PI / 180;
      const r = rangeNm + (i * stagger * (mach * MACH / 3600));
      const x = this.ship.x + Math.sin(rad) * r;
      const y = this.ship.y - Math.cos(rad) * r;
      const t = new Threat(x, y, this.ship.x, this.ship.y, {
        speedKts: mach * MACH * (0.94 + Math.random() * 0.12),
        altM: opts.altM || 5,
        name: opts.name || 'VAMPIRE',
        airframe: opts.airframe || (opts.name === 'DRONE' ? 'drone' : null)
      });
      this.threats.push(t);
      made.push(t);
    }
    return made;
  }

  // Radar horizon against a sea-skimmer
  detectRangeNm(altM) {
    return 2.23 * (Math.sqrt(this.ship.spec.radarHeightM) + Math.sqrt(altM));
  }

  update(dt) {
    let anyNew = false;
    for (const t of this.threats) {
      t.update(dt, this.ship);
      if (!t.detected && !t.dead) {
        const d = Math.hypot(t.x - this.ship.x, t.y - this.ship.y);
        if (d <= this.detectRangeNm(t.altM)) {
          t.detected = true;
          t.trackNum = this.nextTrack++;
          anyNew = true;
        }
      }
    }
    // Cull
    for (let i = this.threats.length - 1; i >= 0; i--) {
      const t = this.threats[i];
      if (t.impacted) { this.leakers++; this.threats.splice(i, 1); continue; }
      if (t.dead) { this.killed++; this.threats.splice(i, 1); continue; }
    }
    const live = this.threats.filter(t => t.detected);
    this.alarm = live.length > 0;
    if (this.alarm) this.alarmT += dt; else this.alarmT = 0;
    return anyNew;
  }

  get detectedThreats() { return this.threats.filter(t => t.detected && !t.dead); }
  get inboundCount() { return this.detectedThreats.length; }
  // Shortest time to impact
  soonestTTI() {
    let m = Infinity;
    for (const t of this.detectedThreats) m = Math.min(m, t.ttiSec(this.ship));
    return m === Infinity ? null : m;
  }
}

// ── RENDERING ─────────────────────────────────────────────────
function drawSmoke(ctx, cam, W, H, field) {
  ctx.save();
  for (const p of field.puffs) {
    const x = cam.nm2sx(p.x, W), y = cam.nm2sy(p.y, H);
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    const life = 1 - p.age / 26;
    const r = (p.r0 + p.age * 0.0016) * cam.pxPerNm;
    if (r < 0.4) continue;
    ctx.fillStyle = `rgba(196,206,214,${life * 0.30})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawThreats(ctx, cam, W, H, board, fc, hoverT) {
  const t = performance.now() / 1000;
  for (const th of board.threats) {
    if (!th.detected) continue;
    const x = cam.nm2sx(th.x, W), y = cam.nm2sy(th.y, H);
    if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;

    // Trail
    ctx.save();
    for (const p of th.trail) {
      const px = cam.nm2sx(p.x, W), py = cam.nm2sy(p.y, H);
      const a = (1 - p.age / 14) * 0.35;
      ctx.fillStyle = `rgba(255,110,90,${a})`;
      ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, 1.6 + p.age * 0.12), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    const isLocked = fc.locked.includes(th);
    const isHover = fc.hoverTarget === th;

    // Body — inverted-V "vampire" marker
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(th.hdg * Math.PI / 180);
    // Real silhouette when zoomed in enough to make it out,
    // otherwise the generic dart so it stays legible at range.
    const airL = cam.pxPerNm * (t.airframe === 'drone' ? 0.0075 : 0.0030);
    let drewReal = false;
    if (typeof drawVehicle === 'function' && airL > 14) {
      drewReal = drawVehicle(ctx, t.airframe, Math.min(90, airL), '#ff453a',
                             { speed: 0 });
    }
    if (!drewReal) {
      ctx.fillStyle = '#ff453a';
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Threat ring pulse
    const pulse = 0.5 + Math.sin(t * 8) * 0.5;
    ctx.strokeStyle = `rgba(255,69,58,${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();

    // Hover acquisition ring — closes as you hold
    if (isHover) {
      const prog = fc.hoverTime / HOVER_LOCK_TIME;
      const r = 30 - prog * 15;
      ctx.strokeStyle = `rgba(255,214,10,0.95)`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2);
      ctx.stroke();
      // Converging brackets
      ctx.strokeStyle = 'rgba(255,214,10,0.5)';
      ctx.lineWidth = 1.4;
      const b = r + 4;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy]) => {
        ctx.beginPath();
        ctx.moveTo(x+sx*b, y+sy*b-sy*6); ctx.lineTo(x+sx*b, y+sy*b); ctx.lineTo(x+sx*b-sx*6, y+sy*b);
        ctx.stroke();
      });
    }

    // Locked indicator
    if (isLocked) {
      ctx.strokeStyle = '#30d158';
      ctx.lineWidth = 2;
      const b = 17;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy]) => {
        ctx.beginPath();
        ctx.moveTo(x+sx*b, y+sy*b-sy*6); ctx.lineTo(x+sx*b, y+sy*b); ctx.lineTo(x+sx*b-sx*6, y+sy*b);
        ctx.stroke();
      });
      ctx.fillStyle = '#30d158';
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText('LOCKED', x, y - 24);
    }

    // Engaged marker
    if (th.engagedBy > 0 && !isLocked) {
      ctx.fillStyle = 'rgba(90,200,250,0.9)';
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`◄${th.engagedBy}`, x, y - 20);
    }

    // Label
    if (cam.pxPerNm > 8) {
      const tti = th.ttiSec(board.ship);
      ctx.fillStyle = 'rgba(255,69,58,0.9)';
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`V${th.trackNum}`, x + 15, y - 4);
      ctx.fillStyle = tti < 20 ? '#ff453a' : 'rgba(255,160,150,0.8)';
      ctx.font = '8px monospace';
      ctx.fillText(`${tti.toFixed(0)}s  M${th.mach.toFixed(1)}`, x + 15, y + 6);
    }
  }
}

function drawInterceptors(ctx, cam, W, H, fc) {
  for (const ic of fc.interceptors) {
    if (ic.t < 0) continue;
    const x = cam.nm2sx(ic.x, W), y = cam.nm2sy(ic.y, H);
    if (x < -70 || x > W + 70 || y < -70 || y > H + 70) continue;

    if (ic.phase === PHASE.BOOST) {
      // Vertical climb — grows and brightens, barely moves
      const g = ic.alt;
      const R = 2 + g * 5;
      // Booster flare
      ctx.fillStyle = `rgba(255,${180 - g*60},60,${0.9 - g*0.3})`;
      ctx.beginPath(); ctx.arc(x, y, R * 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${0.95 - g*0.25})`;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      // Rising glow ring = altitude cue
      ctx.strokeStyle = `rgba(255,200,120,${0.5 * (1-g)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, R * 2.8 + g * 10, 0, Math.PI * 2); ctx.stroke();
      // Efflux blooming outward across the deck
      const bl = ctx.createRadialGradient(x, y, R * 0.4, x, y, R * 6 + g * 22);
      bl.addColorStop(0,   `rgba(255,220,160,${0.30 * (1 - g * 0.5)})`);
      bl.addColorStop(0.4, `rgba(210,170,140,${0.16 * (1 - g * 0.5)})`);
      bl.addColorStop(1,   'rgba(160,140,130,0)');
      ctx.fillStyle = bl;
      ctx.beginPath(); ctx.arc(x, y, R * 6 + g * 22, 0, Math.PI * 2); ctx.fill();
      continue;
    }

    // ── CRUISE ──
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ic.hdg * Math.PI / 180);
    const L = Math.max(6, Math.min(42, cam.pxPerNm * 0.0075));
    const flick = 0.75 + Math.random() * 0.25;

    // Exhaust plume first, so the airframe sits on top of it
    const plume = L * (1.5 + flick * 0.9);
    const pg = ctx.createLinearGradient(0, L * 0.5, 0, L * 0.5 + plume);
    pg.addColorStop(0,    `rgba(255,245,205,${0.85 * flick})`);
    pg.addColorStop(0.22, `rgba(255,178,60,${0.60 * flick})`);
    pg.addColorStop(0.60, `rgba(220,90,40,${0.24 * flick})`);
    pg.addColorStop(1,    'rgba(120,50,30,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(-L * 0.20, L * 0.50);
    ctx.lineTo(-L * 0.30 * flick, L * 0.5 + plume * 0.55);
    ctx.lineTo(0, L * 0.5 + plume);
    ctx.lineTo(L * 0.30 * flick, L * 0.5 + plume * 0.55);
    ctx.lineTo(L * 0.20, L * 0.50);
    ctx.closePath();
    ctx.fill();
    // Hot core
    ctx.fillStyle = `rgba(255,252,235,${0.9 * flick})`;
    ctx.beginPath();
    ctx.ellipse(0, L * 0.60, L * 0.13, L * 0.30 * flick, 0, 0, Math.PI * 2);
    ctx.fill();

    // The real airframe once there is room for it
    let drewBody = false;
    if (typeof drawWeaponIcon === 'function' && L > 15) {
      ctx.save();
      ctx.rotate(-Math.PI / 2);          // icons are drawn nose-right
      drawWeaponIcon(ctx, ic.wk, -L * 0.62, 0, L * 1.3, L * 0.5, '#dfe8ee');
      ctx.restore();
      drewBody = true;
    }
    if (!drewBody) {
      const bw = L * 0.15;
      const bg = ctx.createLinearGradient(-bw, 0, bw, 0);
      bg.addColorStop(0,   '#9fb0bb');
      bg.addColorStop(0.4, '#f2f7fa');
      bg.addColorStop(1,   '#8fa2ae');
      ctx.fillStyle = bg;
      ctx.fillRect(-bw, -L * 0.55, bw * 2, L * 1.1);
      ctx.fillStyle = '#f2f7fa';
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.86);
      ctx.quadraticCurveTo(bw * 1.15, -L * 0.68, bw, -L * 0.52);
      ctx.lineTo(-bw, -L * 0.52);
      ctx.quadraticCurveTo(-bw * 1.15, -L * 0.68, 0, -L * 0.86);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8c4cc';
      ctx.fillRect(-bw * 2.3, L * 0.18, bw * 1.3, L * 0.30);
      ctx.fillRect( bw * 1.0, L * 0.18, bw * 1.3, L * 0.30);
    }
    ctx.restore();

    // Guidance line to target
    if (ic.target && !ic.target.dead) {
      const tx = cam.nm2sx(ic.target.x, W), ty = cam.nm2sy(ic.target.y, H);
      ctx.save();
      ctx.strokeStyle = `rgba(${hexToRgbW(ic.col)},0.16)`;
      ctx.setLineDash([3, 7]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawBlasts(ctx, cam, W, H, fc) {
  for (const b of fc.blasts) {
    const x = cam.nm2sx(b.x, W), y = cam.nm2sy(b.y, H);
    const p = b.age / b.max;
    const scale = b.big ? 1 : 0.5;
    // Flash
    if (p < 0.25) {
      const f = 1 - p / 0.25;
      ctx.fillStyle = `rgba(255,255,235,${f * 0.95})`;
      ctx.beginPath(); ctx.arc(x, y, (10 + p * 40) * scale, 0, Math.PI * 2); ctx.fill();
    }
    // Shock ring
    ctx.strokeStyle = `rgba(255,${b.big ? 200 : 120},80,${(1 - p) * 0.8})`;
    ctx.lineWidth = (2.5 - p * 1.8) * scale;
    ctx.beginPath(); ctx.arc(x, y, p * 65 * scale, 0, Math.PI * 2); ctx.stroke();
    // Secondary ring
    if (b.big && p > 0.15) {
      ctx.strokeStyle = `rgba(255,140,60,${(1 - p) * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, (p - 0.15) * 95, 0, Math.PI * 2); ctx.stroke();
    }
    // Fireball
    if (p < 0.5) {
      ctx.fillStyle = `rgba(255,${140 - p*100},40,${(1 - p * 2) * 0.6})`;
      ctx.beginPath(); ctx.arc(x, y, (6 + p * 22) * scale, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function hexToRgbW(h) {
  return `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
}

// Headless test export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Threat, Interceptor, FireControl, ThreatBoard, SmokeField,
                     ENGAGE, PHASE, MACH, SALVO_CAP_SEMIACTIVE, SALVO_CAP_ACTIVE,
                     HOVER_LOCK_TIME, salvoCapFor };
}

// ═══════════════════════════════════════════════════════════════
//  AVIATION — MH-60R Seahawk
//  Extends the surface picture well beyond the ship's own horizon.
// ═══════════════════════════════════════════════════════════════

const HELO_SPEC = {
  name: 'MH-60R SEAHAWK',
  cruiseKts: 130,
  maxKts: 180,
  altM: 900,           // radar horizon scales with this
  enduranceSec: 3600,  // one hour on station
  radarNm: 80,
  turnRate: 2.4        // deg per second
};

const HELO_STATE = {
  DECK: 'ON DECK',
  LAUNCH: 'LAUNCHING',
  OUTBOUND: 'OUTBOUND',
  ONSTATION: 'ON STATION',
  RTB: 'RETURNING',
  RECOVER: 'RECOVERING'
};

class Helo {
  constructor(ship) {
    this.ship = ship;
    this.x = ship.x; this.y = ship.y;
    this.hdg = ship.hdg;
    this.speed = 0;
    this.state = HELO_STATE.DECK;
    this.airborne = false;
    this.fuel = HELO_SPEC.enduranceSec;
    this.altM = 0;
    this.station = null;      // {x,y} patrol point
    this.trail = [];
    this._t = 0;
    this._tacc = 0;
    this.mode = 'STATION';      // STATION | FOLLOW | SPRINT | HOLD
    this.orbitNm = 2.0;         // orbit radius when on station
    this._orbA = 0;
  }

  get fuelPct() { return Math.max(0, this.fuel / HELO_SPEC.enduranceSec); }

  // Radar horizon from altitude — the whole point of launching
  horizonNm(targetHeightM = 10) {
    return Math.min(HELO_SPEC.radarNm,
      2.23 * (Math.sqrt(Math.max(1, this.altM)) + Math.sqrt(targetHeightM)));
  }

  launch(station) {
    if (this.state !== HELO_STATE.DECK) return false;
    this.state = HELO_STATE.LAUNCH;
    this.x = this.ship.x; this.y = this.ship.y;
    this.hdg = this.ship.hdg;
    this.altM = 0;
    this.speed = 0;
    this.airborne = true;
    this._t = 0;
    this.station = station || null;
    return true;
  }

  vector(x, y) {
    this.station = { x, y };
    this.mode = 'STATION';
    // A move order always overrides a hover, whatever it was doing
    if (this.state === HELO_STATE.DECK) return;
    this.state = HELO_STATE.OUTBOUND;
  }

  // Shadow the ship rather than hold a fixed point
  followShip() {
    this.mode = 'FOLLOW';
    this.station = null;
    if (this.state === HELO_STATE.ONSTATION) this.state = HELO_STATE.OUTBOUND;
  }

  // Hold position — useful when you want a static sensor picture
  holdHere() {
    this.mode = 'HOLD';
    this.station = { x: this.x, y: this.y };
    this.state = HELO_STATE.ONSTATION;
  }

  // Burn fuel faster to get somewhere
  sprint(on) { this.mode = on ? 'SPRINT' : 'STATION'; }

  setOrbit(nm) { this.orbitNm = Math.max(0.5, Math.min(12, nm)); }

  recall() {
    if (!this.airborne) return;
    this.state = HELO_STATE.RTB;
    this.station = null;
  }

  update(dt) {
    if (this.state === HELO_STATE.DECK) return;

    this._t += dt;
    this.fuel -= dt;

    // Bingo fuel — needs enough to get home
    const homeDist = Math.hypot(this.ship.x - this.x, this.ship.y - this.y);
    const timeHome = homeDist / (HELO_SPEC.cruiseKts / 3600);
    if (this.fuel < timeHome + 120 && this.state !== HELO_STATE.RTB &&
        this.state !== HELO_STATE.RECOVER) {
      this.state = HELO_STATE.RTB;
      this.station = null;
      this._bingo = true;
    }

    switch (this.state) {
      case HELO_STATE.LAUNCH:
        this.altM = Math.min(HELO_SPEC.altM, this.altM + 60 * dt);
        // Climb without running away from the ship
        this.speed = this.mode === 'HOLD' ? 0
                   : Math.min(HELO_SPEC.cruiseKts, this.speed + 30 * dt);
        if (this.altM >= HELO_SPEC.altM * 0.8) {
          this.state = (this.station && this.mode !== 'HOLD')
            ? HELO_STATE.OUTBOUND : HELO_STATE.ONSTATION;
        }
        break;

      case HELO_STATE.OUTBOUND: {
        const tgt = this.mode === 'FOLLOW'
          ? { x: this.ship.x, y: this.ship.y } : this.station;
        if (!tgt) { this.state = HELO_STATE.ONSTATION; break; }
        this._steerTo(tgt.x, tgt.y, dt);
        this.speed = this.mode === 'SPRINT' ? HELO_SPEC.maxKts : HELO_SPEC.cruiseKts;
        // Sprinting burns fuel faster
        if (this.mode === 'SPRINT') this.fuel -= dt * 0.7;
        if (Math.hypot(tgt.x - this.x, tgt.y - this.y) < this.orbitNm + 0.6) {
          this.state = HELO_STATE.ONSTATION;
        }
        break;
      }

      case HELO_STATE.ONSTATION: {
        const c = this.mode === 'FOLLOW'
          ? { x: this.ship.x, y: this.ship.y }
          : (this.station || { x: this.ship.x, y: this.ship.y });
        const d = Math.hypot(c.x - this.x, c.y - this.y);
        if (d > this.orbitNm * 1.8) {
          // Drifted off — go back
          this.state = HELO_STATE.OUTBOUND;
        } else if (this.mode === 'HOLD') {
          // Hover in place, nose slowly swinging
          this.speed = 0;
          this.hdg = (this.hdg + 6 * dt) % 360;
        } else {
          // Fly a circuit at the ordered radius
          this._orbA = (this._orbA + (HELO_SPEC.cruiseKts * 0.55 / 3600) /
                        Math.max(0.4, this.orbitNm) * dt * 57.3) % 360;
          const ar = this._orbA * Math.PI / 180;
          const tx = c.x + Math.cos(ar) * this.orbitNm;
          const ty = c.y + Math.sin(ar) * this.orbitNm;
          this._steerTo(tx, ty, dt);
          this.speed = HELO_SPEC.cruiseKts * 0.62;
        }
        break;
      }

      case HELO_STATE.RTB: {
        this._steerTo(this.ship.x, this.ship.y, dt);
        this.speed = HELO_SPEC.maxKts * 0.85;
        if (homeDist < 0.4) this.state = HELO_STATE.RECOVER;
        break;
      }

      case HELO_STATE.RECOVER: {
        this.x += (this.ship.x - this.x) * Math.min(1, dt * 1.5);
        this.y += (this.ship.y - this.y) * Math.min(1, dt * 1.5);
        this.altM = Math.max(0, this.altM - 90 * dt);
        this.speed = Math.max(0, this.speed - 40 * dt);
        if (this.altM <= 1) {
          this.state = HELO_STATE.DECK;
          this.airborne = false;
          this.fuel = HELO_SPEC.enduranceSec;   // refuelled on deck
          this.trail.length = 0;
          this._bingo = false;
        }
        break;
      }
    }

    if (this.state !== HELO_STATE.RECOVER) {
      const step = (this.speed / 3600) * dt;
      const rad = this.hdg * Math.PI / 180;
      this.x += Math.sin(rad) * step;
      this.y -= Math.cos(rad) * step;
    }

    this._tacc += dt;
    if (this._tacc > 1.2 && this.airborne) {
      this._tacc = 0;
      this.trail.push({ x: this.x, y: this.y, age: 0 });
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age += dt;
      if (this.trail[i].age > 90) this.trail.splice(i, 1);
    }
  }

  _steerTo(tx, ty, dt) {
    const want = (Math.atan2(tx - this.x, -(ty - this.y)) * 180 / Math.PI + 360) % 360;
    let err = want - this.hdg;
    while (err > 180) err -= 360;
    while (err < -180) err += 360;
    const max = HELO_SPEC.turnRate * dt * 60;
    this.hdg = (this.hdg + Math.max(-max, Math.min(max, err)) + 360) % 360;
  }
}

// ── HELO RENDERING ────────────────────────────────────────────
function drawHelo(ctx, cam, W, H, helo) {
  if (!helo || !helo.airborne) return;
  const x = cam.nm2sx(helo.x, W), y = cam.nm2sy(helo.y, H);

  // Trail
  ctx.save();
  for (const p of helo.trail) {
    const px = cam.nm2sx(p.x, W), py = cam.nm2sy(p.y, H);
    ctx.fillStyle = `rgba(120,200,255,${(1 - p.age / 90) * 0.16})`;
    ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Sensor footprint
  const r = helo.horizonNm(20) * cam.pxPerNm;
  if (r > 8 && r < Math.max(W, H) * 3) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,200,255,0.16)';
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(60,160,220,0.03)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Vector to station
  if (helo.station && helo.state !== 'ON STATION') {
    const sx = cam.nm2sx(helo.station.x, W), sy = cam.nm2sy(helo.station.y, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(90,200,255,0.3)';
    ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(90,200,255,0.5)';
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ── AIRFRAME: MH-60R from above ──
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(helo.hdg * Math.PI / 180);
  const L = Math.max(9, Math.min(46, cam.pxPerNm * 0.018));

  // Shadow on the water, offset by altitude
  const shOff = (helo.altM / 900) * L * 0.30;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(shOff * 0.5, shOff, L * 0.30, L * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = '#4a5c68', bodyLt = '#68808f', dark = '#33424c';

  // Tail boom
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-L * 0.075, L * 0.16);
  ctx.lineTo(-L * 0.050, L * 0.74);
  ctx.lineTo( L * 0.050, L * 0.74);
  ctx.lineTo( L * 0.075, L * 0.16);
  ctx.closePath(); ctx.fill();

  // Horizontal stabiliser
  ctx.fillStyle = dark;
  ctx.fillRect(-L * 0.26, L * 0.60, L * 0.52, L * 0.075);

  // Tail pylon, canted as on the real aircraft
  ctx.fillStyle = bodyLt;
  ctx.beginPath();
  ctx.moveTo(-L * 0.05, L * 0.72);
  ctx.lineTo(-L * 0.02, L * 0.94);
  ctx.lineTo( L * 0.09, L * 0.94);
  ctx.lineTo( L * 0.05, L * 0.72);
  ctx.closePath(); ctx.fill();

  // Main fuselage — blunt nose, boxy cabin
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.62);
  ctx.quadraticCurveTo( L * 0.16, -L * 0.56,  L * 0.19, -L * 0.34);
  ctx.lineTo( L * 0.21, L * 0.02);
  ctx.lineTo( L * 0.17, L * 0.22);
  ctx.lineTo(-L * 0.17, L * 0.22);
  ctx.lineTo(-L * 0.21, L * 0.02);
  ctx.lineTo(-L * 0.19, -L * 0.34);
  ctx.quadraticCurveTo(-L * 0.16, -L * 0.56, 0, -L * 0.62);
  ctx.closePath(); ctx.fill();

  // Sponsons
  ctx.fillStyle = dark;
  ctx.fillRect(-L * 0.29, -L * 0.06, L * 0.10, L * 0.20);
  ctx.fillRect( L * 0.19, -L * 0.06, L * 0.10, L * 0.20);

  // Engine housings either side of the rotor head
  ctx.fillStyle = bodyLt;
  ctx.fillRect(-L * 0.17, -L * 0.26, L * 0.13, L * 0.24);
  ctx.fillRect( L * 0.04, -L * 0.26, L * 0.13, L * 0.24);

  // Cockpit glazing
  ctx.fillStyle = 'rgba(25,55,80,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.58);
  ctx.quadraticCurveTo( L * 0.13, -L * 0.52,  L * 0.15, -L * 0.34);
  ctx.lineTo(-L * 0.15, -L * 0.34);
  ctx.quadraticCurveTo(-L * 0.13, -L * 0.52, 0, -L * 0.58);
  ctx.closePath(); ctx.fill();

  // Rotor head
  ctx.fillStyle = '#8fa5b2';
  ctx.beginPath(); ctx.arc(0, -L * 0.06, L * 0.075, 0, Math.PI * 2); ctx.fill();

  // Four-blade main rotor
  const spin = (performance.now() / 55) % (Math.PI * 2);
  const R = L * 0.98;
  ctx.save();
  ctx.translate(0, -L * 0.06);
  // Disc blur
  ctx.fillStyle = 'rgba(190,215,235,0.055)';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,225,245,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  // Blades
  ctx.strokeStyle = 'rgba(215,235,250,0.62)';
  ctx.lineWidth = Math.max(1.1, L * 0.045);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = spin + i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * L * 0.09, Math.sin(a) * L * 0.09);
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.stroke();
  }
  ctx.restore();

  // Canted tail rotor
  const tspin = (performance.now() / 32) % (Math.PI * 2);
  ctx.save();
  ctx.translate(L * 0.075, L * 0.90);
  const tr = L * 0.30;
  ctx.fillStyle = 'rgba(190,215,235,0.05)';
  ctx.beginPath(); ctx.arc(0, 0, tr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(205,230,248,0.45)';
  ctx.lineWidth = Math.max(0.8, L * 0.026);
  for (let i = 0; i < 4; i++) {
    const a = tspin + i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * tr, Math.sin(a) * tr);
    ctx.stroke();
  }
  ctx.restore();

  // Navigation lights
  if (L > 14) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(-L * 0.27, L * 0.02, L * 0.042, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#30d158';
    ctx.beginPath(); ctx.arc( L * 0.27, L * 0.02, L * 0.042, 0, Math.PI * 2); ctx.fill();
    // Anti-collision strobe
    if ((performance.now() % 1100) < 90) {
      ctx.fillStyle = 'rgba(255,90,70,0.95)';
      ctx.beginPath(); ctx.arc(0, L * 0.30, L * 0.06, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Label
  if (cam.pxPerNm > 6) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,14,26,0.8)';
    ctx.fillRect(x + 12, y - 16, 96, 26);
    ctx.fillStyle = '#7fd0ff';
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
    ctx.fillText('SEAHAWK 01', x + 16, y - 6);
    const fp = helo.fuelPct;
    ctx.fillStyle = fp < 0.25 ? '#ff6b5e' : 'rgba(160,210,240,0.7)';
    ctx.font = '7.5px monospace';
    ctx.fillText(`${helo.state}  ${Math.round(fp * 100)}%`, x + 16, y + 4);
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.Helo = Helo;
  module.exports.HELO_SPEC = HELO_SPEC;
  module.exports.HELO_STATE = HELO_STATE;
}

// ═══════════════════════════════════════════════════════════════
//  STRIKE — point-target weapons
//  TLAM, ASROC and torpedoes are aimed at a position, not at an
//  inbound track, so they need their own designation flow.
// ═══════════════════════════════════════════════════════════════
class StrikeRound {
  constructor(ship, tx, ty, kind) {
    const E = ENGAGE[kind];
    this.x = ship.x; this.y = ship.y;
    this.tx = tx; this.ty = ty;
    this.kind = kind;
    this.speedKts = E.speedKts;
    this.col = E.col;
    this.t = 0;
    this.dead = false;
    this.impacted = false;
    this.hdg = (Math.atan2(tx - ship.x, -(ty - ship.y)) * 180 / Math.PI + 360) % 360;
    this.trail = [];
    this.totalNm = Math.hypot(tx - ship.x, ty - ship.y);
    // TLAM flies a low cruise profile; a torpedo runs submerged
    this.cruise = (kind === 'tomahawk');
    this.sub = (kind === 'torpedo');
  }

  update(dt) {
    if (this.dead) return;
    this.t += dt;

    // Vertical launch and turnover for the VLS rounds
    if (this.cruise && this.t < 2.0) {
      this.trail.push({ x: this.x, y: this.y, age: 0 });
      this._ageTrail(dt);
      return;
    }

    const dx = this.tx - this.x, dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = (this.speedKts / 3600) * dt;
    if (dist < Math.max(0.02, step * 1.5)) {
      this.impacted = true;
      this.dead = true;
      return;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.hdg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;

    if (this.t % 0.6 < dt) this.trail.push({ x: this.x, y: this.y, age: 0 });
    this._ageTrail(dt);
  }

  _ageTrail(dt) {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age += dt;
      if (this.trail[i].age > 40) this.trail.splice(i, 1);
    }
    if (this.trail.length > 400) this.trail.splice(0, this.trail.length - 400);
  }

  get etaSec() {
    const d = Math.hypot(this.tx - this.x, this.ty - this.y);
    return d / (this.speedKts / 3600);
  }
}

// Manages point-target designation and launch
class StrikeControl {
  constructor(ship) {
    this.ship = ship;
    this.rounds = [];
    this.aimpoints = [];      // {x,y} the player has marked
    this.blasts = [];
    this.weapon = null;
  }

  select(kind) {
    const E = ENGAGE[kind];
    if (!E || E.mode !== 'point') return false;
    this.weapon = kind;
    this.aimpoints = [];
    return true;
  }

  get cap() {
    const E = ENGAGE[this.weapon];
    return E ? (E.salvoCap || 2) : 0;
  }

  // Mark a point. Returns a message for the log.
  addAimpoint(x, y) {
    if (!this.weapon) return null;
    const E = ENGAGE[this.weapon];
    const d = Math.hypot(x - this.ship.x, y - this.ship.y);
    if (d > E.rangeNm) return `OUT OF RANGE — ${E.short} reaches ${E.rangeNm} nm, that is ${d.toFixed(1)} nm`;
    if (this.aimpoints.length >= this.cap) return `${E.short} SALVO FULL — ${this.cap} aimpoints`;
    this.aimpoints.push({ x, y });
    return `${E.short} AIMPOINT ${this.aimpoints.length} SET — ${d.toFixed(1)} nm`;
  }

  clear() { this.aimpoints = []; }

  fire(mag) {
    if (!this.weapon || !this.aimpoints.length) return ['NO AIMPOINT DESIGNATED'];
    const E = ENGAGE[this.weapon];
    const store = mag.weapons[this.weapon] ||
                  (this.weapon === 'torpedo' ? mag.torpedo : null);
    if (!store) return ['WEAPON NOT LOADED'];

    const out = [];
    let fired = 0;
    for (const ap of this.aimpoints) {
      if (store.count <= 0) { out.push(`${E.short} MAGAZINE EMPTY`); break; }
      store.count--;
      if (store.cells !== undefined && E.vls) store.cells = Math.max(0, store.cells - 1);
      const r = new StrikeRound(this.ship, ap.x, ap.y, this.weapon);
      r.t = -fired * 1.4;   // ripple fire
      this.rounds.push(r);
      fired++;
    }
    if (fired > 0) {
      out.unshift(`${E.short} AWAY — ${fired} round${fired > 1 ? 's' : ''}, ` +
                  `time of flight ${Math.round(this.rounds[this.rounds.length-1].etaSec / 60)} min`);
      if (typeof Audio !== 'undefined') {
        for (let i = 0; i < fired; i++) Audio.vlsLaunch(i * 0.9);
      }
    }
    this.aimpoints = [];
    return out;
  }

  update(dt) {
    for (let i = this.rounds.length - 1; i >= 0; i--) {
      const r = this.rounds[i];
      r.update(dt);
      if (r.impacted) {
        this.blasts.push({ x: r.tx, y: r.ty, t: 0, big: true });
        if (typeof Audio !== 'undefined') Audio.intercept();
      }
      if (r.dead) this.rounds.splice(i, 1);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].t += dt;
      if (this.blasts[i].t > 3) this.blasts.splice(i, 1);
    }
  }
}

// ── STRIKE RENDERING ──────────────────────────────────────────
function drawStrike(ctx, cam, W, H, sc) {
  if (!sc) return;

  // Aimpoints
  sc.aimpoints.forEach((ap, i) => {
    const x = cam.nm2sx(ap.x, W), y = cam.nm2sy(ap.y, H);
    const p = 0.5 + Math.sin(performance.now() / 220) * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(255,159,10,${0.6 + p * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 20, y); ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 8, y);  ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 8);
    ctx.moveTo(x, y + 8);  ctx.lineTo(x, y + 20);
    ctx.stroke();
    ctx.fillStyle = '#ff9f0a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`AP ${i + 1}`, x, y - 26);
    ctx.textAlign = 'left';
    ctx.restore();
  });

  // Rounds in flight
  for (const r of sc.rounds) {
    if (r.t < 0) continue;
    const x = cam.nm2sx(r.x, W), y = cam.nm2sy(r.y, H);

    // Trail
    ctx.save();
    for (const p of r.trail) {
      const px = cam.nm2sx(p.x, W), py = cam.nm2sy(p.y, H);
      ctx.fillStyle = r.sub
        ? `rgba(120,180,255,${(1 - p.age / 40) * 0.20})`
        : `rgba(255,190,120,${(1 - p.age / 40) * 0.22})`;
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Line to the aimpoint
    const tx = cam.nm2sx(r.tx, W), ty = cam.nm2sy(r.ty, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,159,10,0.18)';
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // The round itself
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r.hdg * Math.PI / 180);
    const L = Math.max(8, Math.min(30, cam.pxPerNm * 0.004));
    if (typeof drawWeaponIcon === 'function' && L > 16) {
      drawWeaponIcon(ctx, r.kind, -L * 0.5, 0, L, L * 0.35, r.col);
    } else {
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.5); ctx.lineTo(L * 0.16, L * 0.4);
      ctx.lineTo(0, L * 0.22); ctx.lineTo(-L * 0.16, L * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Impacts
  for (const b of sc.blasts) {
    const x = cam.nm2sx(b.x, W), y = cam.nm2sy(b.y, H);
    const k = b.t / 3;
    ctx.save();
    ctx.strokeStyle = `rgba(255,190,90,${(1 - k) * 0.8})`;
    ctx.lineWidth = 3 * (1 - k);
    ctx.beginPath(); ctx.arc(x, y, 10 + k * 70, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,${Math.round(180 - k * 120)},60,${(1 - k) * 0.6})`;
    ctx.beginPath(); ctx.arc(x, y, 16 * (1 - k * 0.6), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.StrikeRound = StrikeRound;
  module.exports.StrikeControl = StrikeControl;
}

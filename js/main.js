// ═══════════════════════════════════════════════════════════════
//  MAIN — game loop, HUD, controls, time
// ═══════════════════════════════════════════════════════════════
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let W = 0, H = 0;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  // Render at native device resolution. On a 4K display this is
  // a real 3840x2160 backing store, not an upscaled 1080p one.
  // Cap the backing store. Beyond ~2.3M pixels the gain is
  // invisible and the fill cost is not.
  const rawDpr = window.devicePixelRatio || 1;
  const MAXPX = 2600000;
  let dpr = Math.min(rawDpr, 2);
  if (W * H * dpr * dpr > MAXPX) dpr = Math.sqrt(MAXPX / (W * H));
  dpr = Math.max(0.75, dpr);
  RENDER_DPR = dpr;
  cv.width  = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Panels scale with the display so they do not shrink to slivers at 4K
  const sc = Math.max(0.85, Math.min(2.2, Math.min(W/1600, H/950)));
  LEFTW = Math.round(BASE_LEFTW * sc);
  RIGHTW = Math.round(BASE_RIGHTW * sc);
  TOPBAR = Math.round(BASE_TOPBAR * sc);
  BOTH = Math.round(BASE_BOTH * sc);
  HUD_S = sc;
  bathyCanvas = null; // force bathymetry rebuild at new scale
}
window.addEventListener('resize', resize);

// ── LAYOUT ────────────────────────────────────────────────────
const BASE_TOPBAR = 44, BASE_LEFTW = 330, BASE_RIGHTW = 250, BASE_BOTH = 76;
let TOPBAR = 44, LEFTW = 262, RIGHTW = 246, BOTH = 76, HUD_S = 1;
let RENDER_DPR = 1;

// ── TIME ──────────────────────────────────────────────────────
const TIME_RATES = [0, 1, 4, 15, 60];
const TIME_LABELS = ['PAUSE', '1x', '4x', '15x', '60x'];
let timeIdx = 1;
let simSeconds = 0;          // seconds since mission start
let missionStartZulu = 4 * 3600 + 12 * 60; // 0412Z

function timeRate() { return TIME_RATES[timeIdx]; }
function zuluString() {
  const tot = Math.floor(missionStartZulu + simSeconds);
  const h = Math.floor(tot / 3600) % 24;
  const m = Math.floor(tot / 60) % 60;
  const s = tot % 60;
  return `${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}Z`;
}
function elapsedString() {
  const tot = Math.floor(simSeconds);
  const h = Math.floor(tot / 3600);
  const m = Math.floor(tot / 60) % 60;
  const s = tot % 60;
  return `T+${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── WORLD ─────────────────────────────────────────────────────
const cam = new Camera();
let own, sensors, ships = [];
let selectedContact = null;
let selectedWeapon = null;
let hoverContact = null;
let board = null, fc = null;
let alarmActive = false, alarmFlash = 0;
let autoSlowed = false, preAlarmTimeIdx = 1;
let drillOpen = false;
let hoverThreat = null;
let lastFrameReal = 0;
let lastLeakers = 0;
let SCEN = null;
let strike = null;
// Animation frame counter. Three draw functions referenced a bare
// `t` that was never declared, which crashed the render loop.
let t = 0;
let helo = null;
let heloVectorMode = false;   // legacy, kept so old calls do not break
let heloSelected = false;     // click the aircraft, then click where to go
let mouseX = 0, mouseY = 0;
let msgs = [];

function pushMsg(text, kind) {
  msgs.unshift({ text, kind: kind || 'info', t: 0 });
  if (msgs.length > 40) msgs.pop();
}

function initWorld(scenario) {
  SCEN = scenario || null;
  const R = (SCEN && SCEN.region) ? SCEN.region : REGIONS.hormuz;
  loadRegion(R);
  DEPTH_MAX = R.depthMax || 80;

  const st = R.ownStart;
  const p = ll2nm(st.lat, st.lon);
  own = new Ship(p.x, p.y, st.hdg, 'friendly', 'ddg');
  own.vesselName = DDG_SPEC.name;
  own.orderSpeed(12);
  own.speed = 12;   // already making way when the mission opens
  ships = [own];

  sensors = new SensorSuite(own);
  board = new ThreatBoard(own);
  fc = new FireControl(own);
  strike = new StrikeControl(own);
  helo = new Helo(own);
  sensors.helo = helo;
  heloVectorMode = false;
  msgs = [];
  lastLeakers = 0;

  // Scenario-specific surface traffic
  const traffic = trafficFor(R.id);
  for (const t of traffic) {
    const q = ll2nm(t.ll[0], t.ll[1]);
    const sh = new Ship(q.x, q.y, t.hdg, t.fac || 'neutral', t.type);
    sh.vesselName = t.name;
    sh.speed = t.spd; sh.ordSpeed = t.spd;
    sh.spec = {
      ...DDG_SPEC,
      lengthM: t.type === 'supertanker' ? 333 : t.type === 'tanker' ? 245 :
               t.type === 'cargo' ? 200 : t.type === 'patrol' ? 55 : 30,
      maxSpeedKts: t.type === 'patrol' ? 30 : 17,
      accelRate: 0.05, decelRate: 0.06,
      turnRateFactor: t.type === 'patrol' ? 0.6 : 0.14,
      radarHeightM: 20, radarMaxNm: 40, maxRudderDeg: 30, rudderRate: 1.2
    };
    ships.push(sh);
    sensors.addContact(sh);
  }

  cam.x = own.x; cam.y = own.y;
  cam.pxPerNm = 22; cam.targetPxPerNm = 22;
  cam.follow = true;

  if (SCEN && SCEN.init) SCEN.init(gameCtx());

  pushMsg('CIC manned and ready. All stations report.', 'ok');
  pushMsg(`SPY-1D radiating. Horizon ${sensors.horizonNm(28).toFixed(1)} nm vs large contact.`, 'info');
  if (SCEN && SCEN.objectives.length) {
    const o = SCEN.objectives.find(x => !x.done);
    if (o && o.hint) pushMsg(o.hint, 'info');
  }
}

// Surface traffic appropriate to each operating area
function trafficFor(regionId) {
  if (regionId === 'florida') {
    return [
      { ll:[28.30,-80.20], hdg:20,  spd:9,  type:'cargo',  name:'MV COASTAL RUNNER' },
      { ll:[28.90,-80.15], hdg:200, spd:11, type:'tanker', name:'MV SEABOARD' },
      { ll:[28.55,-80.28], hdg:140, spd:14, type:'patrol', name:'USCG SENTINEL' }
    ];
  }
  if (regionId === 'southatlantic') {
    return [
      { ll:[-34.60,14.60], hdg:290, spd:13, type:'cargo',       name:'MV KAROO' },
      { ll:[-35.30,13.60], hdg:75,  spd:12, type:'supertanker', name:'MV CAPE AGULHAS' }
    ];
  }
  // Hormuz
  return [
    { ll:[26.63,56.66], hdg:250, spd:12, type:'supertanker', name:'MV ATLAS PIONEER' },
    { ll:[26.47,56.10], hdg:72,  spd:11, type:'tanker',      name:'MV GULF SPIRIT' },
    { ll:[26.70,56.50], hdg:242, spd:13, type:'cargo',       name:'MV HAN SHUN' },
    { ll:[26.40,56.55], hdg:66,  spd:10, type:'cargo',       name:'MV NORDIC STAR' },
    { ll:[26.86,56.62], hdg:200, spd:16, type:'patrol',      name:'PATROL 412' },
    { ll:[26.30,56.30], hdg:300, spd:9,  type:'tanker',      name:'MV SEA HARMONY' },
    { ll:[26.95,56.18], hdg:205, spd:15, type:'supertanker', name:'MV ZAGROS DAWN', fac:'unknown' }
  ];
}

// Handle passed to scenarios so they can act on the world
function gameCtx() {
  return {
    own, sensors, board, fc, ships, cam, helo,
    log: (m, k) => pushMsg(m, k),
    nm: (lat, lon) => ll2nm(lat, lon)
  };
}

// ── INPUT ─────────────────────────────────────────────────────
let dragging = false, dragStartX = 0, dragStartY = 0, camStartX = 0, camStartY = 0;
let uiButtons = [];

cv.addEventListener('mousemove', e => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (App.screen !== SCREEN.TACTICAL) return;
  if (dragging) {
    cam.x = camStartX - (mouseX - dragStartX) / cam.pxPerNm;
    cam.y = camStartY - (mouseY - dragStartY) / cam.pxPerNm;
    cam.follow = false;
  }
  // Hover detection over contacts
  hoverContact = pickContact(mouseX, mouseY);
  cv.style.cursor = hoverContact ? 'pointer' : (dragging ? 'grabbing' : 'crosshair');
});

cv.addEventListener('mousedown', e => {
  if (e.button === 1) { // middle = pan
    dragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    camStartX = cam.x; camStartY = cam.y;
    e.preventDefault();
  }
});
window.addEventListener('mouseup', () => { dragging = false; });

cv.addEventListener('click', e => {
  Audio.init(); Audio.resume();
  if (App.screen !== SCREEN.TACTICAL) { App.onClick(e.clientX, e.clientY); return; }
  const mx = e.clientX, my = e.clientY;

  // ── 1. PANEL BUTTONS ──
  for (const b of decideBtns) {
    if (hit(b, mx, my)) { SCEN.choose(b.id, gameCtx()); Audio.fireCommand(); return; }
  }
  for (const b of heloBtns) {
    if (b.act && hit(b, mx, my)) { b.act(); Audio.uiClick(); return; }
  }
  for (const b of uiButtons) {
    if (hit(b, mx, my)) { b.act(); return; }
  }

  if (!inMapArea(mx, my)) return;

  // ── 2. THE AIRCRAFT OWNS THE CLICK WHILE IT IS SELECTED ──
  if (helo && helo.airborne) {
    if (heloHitTest(mx, my)) {
      heloSelected = !heloSelected;
      pushMsg(heloSelected
        ? 'AIR: Seahawk 01 selected. Click anywhere to send it there.'
        : 'AIR: Seahawk 01 deselected.', 'info');
      Audio.uiClick();
      return;
    }
    if (heloSelected) {
      const wx = cam.sx2nm(mx, W), wy = cam.sy2nm(my, H);
      helo.vector(wx, wy);
      const d = Math.hypot(wx - own.x, wy - own.y);
      pushMsg(`AIR: Seahawk 01 proceeding to a point ${d.toFixed(1)} nm out.`, 'ok');
      Audio.lockOn();
      return;
    }
  }

  // ── 3. STRIKE AIMPOINT ──
  if (strike && strike.weapon) {
    const wx = cam.sx2nm(mx, W), wy = cam.sy2nm(my, H);
    const msg = strike.addAimpoint(wx, wy);
    if (msg) {
      const bad = msg.indexOf('OUT OF RANGE') >= 0;
      pushMsg(msg, bad ? 'alert' : 'ok');
      bad ? Audio.dryFire() : Audio.lockOn();
    }
    return;
  }

  // ── 4. SELECT A CONTACT ──
  const c = pickContact(mx, my);
  if (c) {
    selectedContact = c;
    sensors.focus(c);
    pushMsg(`Sensors focused on ${c.trackNum ? 'TRACK ' + c.trackNum : 'unknown contact'} — classification accelerated.`, 'info');
  } else {
    selectedContact = null;
    sensors.focus(null);
  }
});

function hit(b, mx, my) {
  return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
}

cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (App.screen !== SCREEN.TACTICAL) return;
  const mx = e.clientX, my = e.clientY;
  if (!inMapArea(mx, my)) return;
  // RIGHT CLICK on a locked threat = drop it from the solution
  const th = pickThreat(mx, my);
  if (th && fc.locked.includes(th)) {
    fc.unlock(th);
    Audio.lockRelease();
    pushMsg(`TRACK V${th.trackNum} released.`, 'info');
    return;
  }
  const nx = cam.sx2nm(mx, W), ny = cam.sy2nm(my, H);
  const dx = nx - own.x, dy = ny - own.y;
  const brg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  own.orderHeading(brg);
  const dist = Math.hypot(dx, dy);
  pushMsg(`OOD: Coming to course ${String(Math.round(brg)).padStart(3,'0')}. Range to point ${dist.toFixed(1)} nm.`, 'ok');
});

cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (App.onWheel(e.deltaY, e.clientX, e.clientY)) return;
  if (App.screen !== SCREEN.TACTICAL) return;
  const f = e.deltaY < 0 ? 1.14 : 1 / 1.14;
  cam.zoomBy(f, e.clientX, e.clientY, W, H);
}, { passive: false });

// Held-key state for continuous helm control
const keys = {};
window.addEventListener('keyup', e => { keys[e.key] = false; });
// Losing focus must not leave the rudder jammed over
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

window.addEventListener('keydown', e => {
  Audio.init(); Audio.resume();
  const k = e.key;
  keys[k] = true;
  // Abort tactical back to the chart
  if (App.screen === SCREEN.TACTICAL && k === 'Escape' && e.shiftKey) {
    App.exitTactical(); return;
  }
  if (App.onKey(k, e)) { e.preventDefault(); return; }
  if (App.screen !== SCREEN.TACTICAL) return;
  // FIRE — spacebar when a solution exists, otherwise pause
  if (k === ' ' && strike && strike.weapon && strike.aimpoints.length) {
    for (const m of strike.fire(own.mag)) pushMsg(m, 'alert');
    return;
  }
  if (k === ' ') {
    e.preventDefault();
    if (fc && fc.weapon && fc.locked.length) {
      for (const line of fc.fire(own.mag)) pushMsg(line, 'alert');
      return;
    }
    timeIdx = timeIdx === 0 ? 1 : 0; return;
  }
  if (k === 'x' || k === 'X') { if (strike) strike.clear();
    if (fc) { fc.clear(); Audio.lockRelease(); pushMsg('Firing solution cleared.', 'info'); } return; }
  if (k === 'v' || k === 'V') {
    if (fc) { fc.doubleSalvo = !fc.doubleSalvo;
      pushMsg(`Salvo doctrine: ${fc.doubleSalvo ? 'DOUBLE (shoot-shoot)' : 'SINGLE'}`, 'warn'); }
    return;
  }
  // H launches or recalls. Everything else is done by selecting
  // the aircraft and clicking, like any other unit.
  if (k === 'h' || k === 'H') {
    if (!helo) return;
    if (!helo.airborne) {
      launchHelo();
    } else {
      helo.recall();
      heloSelected = false;
      pushMsg('AIR: Seahawk 01 recalled, returning to the ship.', 'info');
      Audio.uiClick();
    }
    return;
  }
  if (SCEN && SCEN.phase === 'DECIDE' && !SCEN.decision) {
    if (k === 'r' || k === 'R') { SCEN.choose('report', gameCtx()); Audio.fireCommand(); return; }
    if (k === 't' || k === 'T') { SCEN.choose('strike', gameCtx()); Audio.fireCommand(); return; }
  }
  if (k === 't' || k === 'T') { drillOpen = !drillOpen; Audio.uiClick(); return; }
  if (k === 'F3') { PERF.show = !PERF.show; return; }
  if (k === 'm' || k === 'M') {
    const on = Audio.toggle();
    pushMsg(`Audio ${on ? 'ON' : 'MUTED'}`, 'info');
    if (on) Audio.uiClick();
    return;
  }
  if (k === '[') { Audio.setVolume(Audio.volume - 0.1); pushMsg(`Volume ${Math.round(Audio.volume*100)}%`, 'info'); Audio.uiClick(); return; }
  if (k === ']') { Audio.setVolume(Audio.volume + 0.1); pushMsg(`Volume ${Math.round(Audio.volume*100)}%`, 'info'); Audio.uiClick(); return; }
  // Weapon hotkeys
  if (k === 'z' || k === 'Z') { selWeapon('sm2'); return; }
  if (k === 'c' || k === 'C') { selWeapon('essm'); return; }
  if (k === 'b' || k === 'B') { selWeapon('sm6'); return; }
  if (k === 'g' || k === 'G') { selWeapon('gun'); return; }
  if (k >= '1' && k <= '5') { timeIdx = parseInt(k) - 1; return; }
  if (k === '+' || k === '=') cam.zoomBy(1.3, W/2, H/2, W, H);
  if (k === '-' || k === '_') cam.zoomBy(1/1.3, W/2, H/2, W, H);
  if (k === 'f' || k === 'F') { cam.follow = !cam.follow; pushMsg(`Camera ${cam.follow ? 'following ownship' : 'free'}`, 'info'); }
  if (k === 'Escape' && heloSelected) { heloSelected = false; Audio.uiClick(); return; }
  if (k === 'Escape') {
    selectedContact = null; sensors.focus(null);
    selectedWeapon = null;
    if (fc) { fc.weapon = null; fc.clear(); }
  }
  // Speed orders
  if (k === 'w' || k === 'W') { own.orderSpeed(Math.min(own.maxSpeed, own.ordSpeed + 5)); pushMsg(`OOD: Speed ${own.ordSpeed.toFixed(0)} knots.`, 'ok'); }
  if (k === 's' || k === 'S') { own.orderSpeed(Math.max(0, own.ordSpeed - 5)); pushMsg(`OOD: Speed ${own.ordSpeed.toFixed(0)} knots.`, 'ok'); }
  // A/D are held for continuous rudder — handled in update()
});

function selWeapon(wk) {
  if (!fc) return;
  const E = (typeof ENGAGE !== 'undefined') ? ENGAGE[wk] : null;

  // TLAM, ASROC and torpedoes are aimed at a point on the chart,
  // not at an inbound track, so they use the strike controller.
  if (E && E.mode === 'point') {
    fc.clear();
    fc.weapon = null;
    strike.select(wk);
    selectedWeapon = wk;
    Audio.weaponSelect();
    pushMsg(`${E.short} SELECTED — click the chart to set an aimpoint. ` +
            `Range ${E.rangeNm} nm, up to ${strike.cap} rounds.`, 'warn');
    return;
  }

  strike.weapon = null;
  strike.clear();
  fc.selectWeapon(wk);
  selectedWeapon = fc.weapon;
  Audio.weaponSelect();
  if (fc.weapon) {
    const E = ENGAGE[wk];
    pushMsg(`${E.short} SELECTED — range ${E.rangeNm} nm, max ${salvoCapFor(wk)} simultaneous.`, 'info');
  }
}

function inMapArea(x, y) {
  return x > LEFTW && x < W - RIGHTW && y > TOPBAR && y < H - BOTH;
}

function pickThreat(mx, my) {
  if (!inMapArea(mx, my) || !board) return null;
  let best = null, bestD = 26;
  for (const t of board.detectedThreats) {
    const x = cam.nm2sx(t.x, W), y = cam.nm2sy(t.y, H);
    const d = Math.hypot(mx - x, my - y);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function pickContact(mx, my) {
  if (!inMapArea(mx, my)) return null;
  let best = null, bestD = 22;
  for (const c of sensors.contacts) {
    const x = cam.nm2sx(c.dx, W), y = cam.nm2sy(c.dy, H);
    const d = Math.hypot(mx - x, my - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// ── UPDATE ────────────────────────────────────────────────────
let lastT = performance.now();

function update() {
  const now = performance.now();
  let realDt = (now - lastT) / 1000;
  lastT = now;
  realDt = Math.min(0.05, realDt);
  t++;

  cam.update(realDt);

  const rate = timeRate();
  if (rate > 0) {
    // Sub-step at high compression so physics stays stable
    const total = realDt * rate;
    const steps = Math.min(40, Math.max(1, Math.ceil(total / 0.5)));
    const dt = total / steps;
    // Continuous helm — hold A or D to put the rudder over
    const pl = keys['a'] || keys['A'] || keys['ArrowLeft'];
    const pr = keys['d'] || keys['D'] || keys['ArrowRight'];
    if (own && (pl || pr)) {
      // Scale with time compression so the helm feels the same at 1x and 15x
      const swing = 34 * realDt * Math.max(1, Math.min(6, timeRate()));
      if (pl) own.orderHeading(own.ordHdg - swing);
      if (pr) own.orderHeading(own.ordHdg + swing);
    }

    for (let i = 0; i < steps; i++) {
      for (const s of ships) s.update(dt);
      sensors.update(dt);
      board.update(dt);
      fc.update(dt);
      if (strike) strike.update(dt);
      if (helo) helo.update(dt);
      if (SCEN && SCEN.state === 'running') SCEN.update(dt, gameCtx());
      simSeconds += dt;
    }
  }

  // ── ALARM STATE ──
  const wasAlarm = alarmActive;
  alarmActive = board.alarm;
  if (alarmActive && !wasAlarm) {
    pushMsg('*** AIR ACTION PORT — VAMPIRE INBOUND ***', 'alert');
    if (timeIdx > 1) { preAlarmTimeIdx = timeIdx; timeIdx = 1; }
    autoSlowed = true;
    Audio.newContact();
  }
  if (!alarmActive && wasAlarm) {
    pushMsg('Threat axis clear. Air action secured.', 'ok');
    autoSlowed = false;
    Audio.stopAlarm();
    Audio.threatClear();
  }
  alarmFlash += realDt * 6;
  if (SCEN && SCEN.activePrompt) {
    SCEN.promptT += realDt;
    if (SCEN.promptT > 6.5) SCEN.activePrompt = null;
  }

  // Mission resolution
  if (SCEN && SCEN.state !== 'running' && !SCEN._ended) {
    SCEN._ended = true;
    SCEN._endT = 0;
  }
  if (SCEN && SCEN._ended) {
    SCEN._endT += realDt;
    if (SCEN._endT > 2.2) { App.finishMission(SCEN.result); return; }
  }

  // Klaxon — cadence tightens as impact nears
  let urgency = 0;
  if (alarmActive) {
    const tti = board.soonestTTI();
    if (tti !== null) urgency = Math.max(0, Math.min(1, 1 - tti / 60));
  }
  Audio.updateAlarm(realDt, alarmActive, urgency);

  // Music yields to the alarm. Without this the klaxon cadence and
  // the lock confirmation get buried, and those carry information.
  MusicSys.setCombat(alarmActive);

  // Drive the sailing / tension / action escalation from what is
  // actually happening rather than from a scripted cue.
  const held = sensors ? sensors.contacts.filter(c => c.held) : [];
  MusicSys.updateIntensity(realDt, {
    threats:    board ? board.inboundCount : 0,
    nearestTTI: board ? board.soonestTTI() : null,
    firing:     !!(fc && (fc.interceptors.length > 0 || fc.locked.length > 0)),
    hostiles:   held.filter(c => c.knowsType && c.ship.faction === 'hostile').length,
    unknowns:   held.filter(c => !c.knowsType).length
  });

  // Leaker detection — a hit on ownship
  if (board.leakers > lastLeakers) {
    const n = board.leakers - lastLeakers;
    for (let i = 0; i < n; i++) Audio.leaker();
    pushMsg(`*** HIT — ${n} VAMPIRE${n > 1 ? 'S' : ''} STRUCK OWNSHIP ***`, 'alert');
    lastLeakers = board.leakers;
  }

  // Intercept results
  for (const b of fc.blasts) {
    if (!b._snd) {
      b._snd = true;
      if (b.big) Audio.intercept(); else Audio.missShot();
    }
  }

  // ── HOVER-TO-LOCK (real time, unaffected by compression) ──
  hoverThreat = pickThreat(mouseX, mouseY);
  const prevHoverT = fc.hoverTime;
  const lockEv = fc.updateHover(hoverThreat, realDt);
  // Ticking while the acquisition ring closes
  if (fc.hoverTarget && fc.hoverTime > 0) {
    const prog = fc.hoverTime / HOVER_LOCK_TIME;
    const step = 0.09;
    if (Math.floor(fc.hoverTime / step) > Math.floor(prevHoverT / step)) {
      Audio.lockTick(prog);
    }
  }
  if (lockEv === 'LOCKED') {
    const t = fc.locked[fc.locked.length - 1];
    pushMsg(`TRACK V${t.trackNum} DESIGNATED  (${fc.locked.length}/${fc.cap})`, 'warn');
    if (fc.locked.length >= fc.cap) Audio.lockFull(); else Audio.lockOn();
    if (SCEN && SCEN.onEvent) SCEN.onEvent('lock', t, gameCtx());
  }

  if (cam.follow) { cam.x = own.x; cam.y = own.y; }
  for (const m of msgs) m.t += realDt;
}

// ── HUD ───────────────────────────────────────────────────────
function panel(x, y, w, h, title) {
  ctx.fillStyle = 'rgba(6,16,28,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(70,140,190,0.30)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (title) {
    ctx.fillStyle = 'rgba(90,170,220,0.75)';
    ctx.font = `bold ${9*HUD_S}px monospace`;
    ctx.textAlign = 'left';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(title, x + 10, y + 15);
    ctx.letterSpacing = '0px';
    ctx.strokeStyle = 'rgba(70,140,190,0.22)';
    ctx.beginPath(); ctx.moveTo(x + 8, y + 22); ctx.lineTo(x + w - 8, y + 22); ctx.stroke();
  }
}

function drawTopBar() {
  ctx.fillStyle = 'rgba(4,12,22,0.97)';
  ctx.fillRect(0, 0, W, TOPBAR);
  ctx.strokeStyle = 'rgba(70,140,190,0.35)';
  ctx.beginPath(); ctx.moveTo(0, TOPBAR + 0.5); ctx.lineTo(W, TOPBAR + 0.5); ctx.stroke();

  ctx.fillStyle = '#4da6ff';
  ctx.font = `bold ${13*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.fillText('◈ COMBAT INFORMATION CENTER', 14, 27);

  ctx.fillStyle = 'rgba(150,190,220,0.55)';
  ctx.font = `${10*HUD_S}px monospace`;
  ctx.fillText(`${DDG_SPEC.hull}  ·  ${DDG_SPEC.class} ${DDG_SPEC.flight}  ·  MASTER ${DDG_SPEC.co}`, 268*HUD_S, 27*HUD_S);

  // Time block — centre
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f2fa'; ctx.font = `bold ${15*HUD_S}px monospace`;
  ctx.fillText(zuluString(), cx - 60, 28);
  ctx.fillStyle = 'rgba(140,180,210,0.5)'; ctx.font = `${10*HUD_S}px monospace`;
  ctx.fillText(elapsedString(), cx + 40, 28);

  // Time controls
  uiButtons = uiButtons.filter(b => b.grp !== 'time');
  const bw = 46, bh = 22, bx0 = cx + 110;
  TIME_LABELS.forEach((lbl, i) => {
    const bx = bx0 + i * (bw + 3), by = 11;
    const on = timeIdx === i;
    ctx.fillStyle = on ? 'rgba(60,200,120,0.22)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = on ? 'rgba(60,220,130,0.9)' : 'rgba(70,140,190,0.28)';
    ctx.lineWidth = on ? 1.5 : 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = on ? '#4ef09a' : 'rgba(150,190,220,0.6)';
    ctx.font = `${on ? 'bold ' : ''}10px monospace`; ctx.textAlign = 'center';
    ctx.fillText(lbl, bx + bw / 2, by + 15);
    uiButtons.push({ x: bx, y: by, w: bw, h: bh, grp: 'time', act: () => { timeIdx = i; } });
  });

  // Zoom tier indicator
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(90,170,220,0.6)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText(`VIEW: ${cam.tier}   ${cam.widthNm(W - LEFTW - RIGHTW).toFixed(1)} nm across`, W - 14, 40);
  // Audio indicator
  ctx.textAlign = 'right';
  ctx.fillStyle = Audio.enabled ? 'rgba(48,209,88,0.7)' : 'rgba(255,69,58,0.7)';
  ctx.font = `${9*HUD_S}px monospace`;
  const bars = Math.round(Audio.volume * 5);
  let vb = '';
  for (let i = 0; i < 5; i++) vb += i < bars ? '▮' : '▯';
  const st = MusicSys.enabled && MusicSys.inTactical ? MusicSys.intensity.toUpperCase() : '';
  const stCol = MusicSys.intensity === 'action' ? 'rgba(255,90,70,0.8)'
              : MusicSys.intensity === 'tension' ? 'rgba(255,190,60,0.7)'
              : 'rgba(120,180,220,0.5)';
  ctx.fillText(`${Audio.enabled ? '♪' : '✕'} ${vb}  [M] [ ]`, W - 14, 20);
  if (st) {
    ctx.fillStyle = stCol;
    ctx.font = '8px monospace';
    ctx.fillText(st, W - 14, 32);
  }
}

function drawLeftPanel() {
  const U = HUD_S;
  const x = 0, y = TOPBAR, w = LEFTW, h = H - TOPBAR;
  panel(x, y, w, h, 'OWNSHIP');
  let py = y + 38*U;
  const lx = 14*HUD_S;

  // Heading / speed dials
  ctx.fillStyle = 'rgba(120,170,205,0.55)'; ctx.font = `${9*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.fillText('HEADING', lx, py);
  ctx.fillText('SPEED', lx + 108, py);
  py += 20*HUD_S;
  ctx.fillStyle = '#e8f2fa'; ctx.font = `bold ${22*HUD_S}px monospace`;
  ctx.fillText(String(Math.round(own.hdg)).padStart(3, '0') + '°', lx, py);
  ctx.fillText(own.speed.toFixed(1), lx + 108, py);
  ctx.fillStyle = 'rgba(140,180,210,0.5)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText('kts', lx + 108 + 52, py);
  py += 14*HUD_S;
  // Ordered values
  ctx.fillStyle = 'rgba(255,200,60,0.75)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText(`ORD ${String(Math.round(own.ordHdg)).padStart(3,'0')}°`, lx, py);
  ctx.fillText(`ORD ${own.ordSpeed.toFixed(0)} kts`, lx + 108, py);
  py += 16*HUD_S;

  // Rudder indicator
  ctx.fillStyle = 'rgba(120,170,205,0.55)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText('RUDDER', lx, py); py += 8*HUD_S;
  const rbW = w - 28, rbX = lx, rbY = py;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(rbX, rbY, rbW, 10);
  ctx.strokeStyle = 'rgba(70,140,190,0.25)';
  ctx.strokeRect(rbX + 0.5, rbY + 0.5, rbW - 1, 9);
  const mid = rbX + rbW / 2;
  ctx.strokeStyle = 'rgba(150,190,220,0.4)';
  ctx.beginPath(); ctx.moveTo(mid, rbY - 2); ctx.lineTo(mid, rbY + 12); ctx.stroke();
  const rFrac = own.rudder / own.spec.maxRudderDeg;
  ctx.fillStyle = Math.abs(rFrac) > 0.7 ? '#ff9f0a' : '#4da6ff';
  const rw = Math.abs(rFrac) * (rbW / 2);
  ctx.fillRect(rFrac >= 0 ? mid : mid - rw, rbY + 1, rw, 8);
  py += 16*HUD_S;
  ctx.fillStyle = 'rgba(140,180,210,0.5)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.fillText(`${own.rudder >= 0 ? 'STBD' : 'PORT'} ${Math.abs(own.rudder).toFixed(0)}°`, lx, py);
  ctx.textAlign = 'right';
  ctx.fillText(own.autoHelm ? 'AUTO HELM' : 'MANUAL', lx + rbW, py);
  ctx.textAlign = 'left';
  py += 18*HUD_S;

  // Position
  ctx.strokeStyle = 'rgba(70,140,190,0.18)';
  ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(w - 14, py); ctx.stroke();
  py += 14*HUD_S;
  ctx.fillStyle = 'rgba(120,170,205,0.55)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText('POSITION', lx, py); py += 13*HUD_S;
  ctx.fillStyle = 'rgba(200,225,245,0.8)'; ctx.font = `${10*HUD_S}px monospace`;
  ctx.fillText(fmtLatLon(own.x, own.y), lx, py); py += 16*HUD_S;
  const dep = depthAt(own.x, own.y);
  ctx.fillStyle = dep < 20 ? '#ff9f0a' : 'rgba(120,170,205,0.55)';
  ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText(`DEPTH UNDER KEEL  ${(dep - own.spec.draftM).toFixed(0)} m`, lx, py);
  py += 18*HUD_S;

  // ── WEAPONS ──
  ctx.strokeStyle = 'rgba(70,140,190,0.18)';
  ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(w - 14*U, py); ctx.stroke();
  py += 18*U;
  ctx.fillStyle = 'rgba(90,170,220,0.75)';
  ctx.font = `bold ${10*U}px monospace`;
  ctx.textAlign = 'left';
  setLSm(ctx, `${1.5*U}px`);
  ctx.fillText('MAGAZINE', lx, py);
  setLSm(ctx, '0px');
  py += 16*U;

  const M = own.mag;
  const usedCells = Object.values(M.weapons).reduce((a, wp) => a + wp.cells, 0);
  ctx.fillStyle = 'rgba(120,170,205,0.55)';
  ctx.font = `${9*U}px monospace`;
  ctx.fillText(`Mk 41 VLS  —  ${usedCells} / ${M.vlsTotal} CELLS`, lx, py);
  py += 8*U;

  // Cell occupancy strip
  const stripW = w - 28*U;
  let cx2 = lx;
  for (const [k, wp] of Object.entries(M.weapons)) {
    ctx.fillStyle = wp.col;
    ctx.fillRect(cx2, py, stripW * (wp.cells / M.vlsTotal) - 1, 8*U);
    cx2 += stripW * (wp.cells / M.vlsTotal);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(cx2, py, stripW - (cx2 - lx), 8*U);
  ctx.strokeStyle = 'rgba(70,140,190,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(lx + 0.5, py + 0.5, stripW - 1, 8*U - 1);
  py += 22*U;

  // Weapon rows
  uiButtons = uiButtons.filter(b => b.grp !== 'weap');
  const rows = [
    ...Object.entries(M.weapons).map(([k, wp]) => ({ k, wp, count: wp.count })),
    { k: 'gun',     wp: M.gun,     count: M.gun.rounds },
    { k: 'torpedo', wp: M.torpedo, count: M.torpedo.count },
    { k: 'ciws',    wp: M.ciws,    count: M.ciws.rounds }
  ];

  const rowH = 44*U;
  for (const r of rows) {
    if (py + rowH > H - BOTH - 10*U) break;
    const on = (fc && fc.weapon === r.k);
    const empty = r.count <= 0;

    if (on) {
      ctx.fillStyle = `rgba(${hexToRgb(r.wp.col)},0.13)`;
      ctx.fillRect(lx - 6*U, py - 4*U, w - 16*U, rowH);
      ctx.strokeStyle = r.wp.col;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(lx - 6*U + 0.5, py - 4*U + 0.5, w - 16*U - 1, rowH - 1);
    }
    // Colour tab
    ctx.fillStyle = empty ? 'rgba(90,95,105,0.5)' : r.wp.col;
    ctx.fillRect(lx - 6*U, py - 4*U, 3.5*U, rowH);

    // Silhouette
    drawWeaponIcon(ctx, r.k, lx + 8*U, py + 11*U, 52*U, 20*U, empty ? '#5a6470' : r.wp.col);

    // Name
    ctx.textAlign = 'left';
    ctx.fillStyle = empty ? 'rgba(140,150,165,0.5)' : on ? r.wp.col : 'rgba(222,240,252,0.92)';
    ctx.font = `bold ${12*U}px monospace`;
    ctx.fillText(r.wp.short, lx + 68*U, py + 8*U);

    // Role
    ctx.fillStyle = empty ? 'rgba(110,120,135,0.4)' : 'rgba(140,185,215,0.55)';
    ctx.font = `${9*U}px monospace`;
    ctx.fillText(r.wp.role, lx + 68*U, py + 22*U);

    // Range and salvo cap
    ctx.fillStyle = 'rgba(120,165,200,0.45)';
    ctx.font = `${8.5*U}px monospace`;
    const cap = (typeof ENGAGE !== 'undefined' && ENGAGE[r.k])
      ? `  ·  max ${salvoCapFor(r.k)}` : '';
    ctx.fillText(`${r.wp.rangeNm} nm${cap}`, lx + 68*U, py + 34*U);

    // Count
    ctx.textAlign = 'right';
    ctx.fillStyle = empty ? '#ff5a48' : 'rgba(235,248,255,0.95)';
    ctx.font = `bold ${17*U}px monospace`;
    ctx.fillText(String(r.count), w - 18*U, py + 12*U);
    if (on) {
      ctx.fillStyle = r.wp.col;
      ctx.font = `bold ${8*U}px monospace`;
      ctx.fillText('ARMED', w - 18*U, py + 26*U);
    } else if (empty) {
      ctx.fillStyle = 'rgba(255,90,72,0.7)';
      ctx.font = `${8*U}px monospace`;
      ctx.fillText('EMPTY', w - 18*U, py + 26*U);
    }
    ctx.textAlign = 'left';

    if (!empty) uiButtons.push({
      x: lx - 6*U, y: py - 4*U, w: w - 16*U, h: rowH, grp: 'weap',
      act: () => {
        if (typeof ENGAGE !== 'undefined' && ENGAGE[r.k]) selWeapon(r.k);
        else pushMsg(`${r.wp.name} — no engagement profile yet.`, 'info');
      }
    });
    py += rowH + 4*U;
  }

  // Detail card for whatever is armed
  if (fc && fc.weapon && py + 140*U < H - BOTH) {
    py += 6*U;
    const wpDef = M.weapons[fc.weapon] ||
      (fc.weapon === 'gun' ? M.gun : fc.weapon === 'torpedo' ? M.torpedo : M.ciws);
    drawWeaponCard(ctx, fc.weapon, lx - 6*U, py, w - 16*U, U, wpDef.col);
  }
}

// Safe letterSpacing for the tactical HUD
function setLSm(ctx, v) { try { ctx.letterSpacing = v; } catch (e) {} }

function drawRightPanel() {
  const U = HUD_S;
  const x = W - RIGHTW, y = TOPBAR, w = RIGHTW, h = H - TOPBAR - BOTH;
  panel(x, y, w, h, '');

  // Mission block first — it returns where it actually ended, so the
  // tactical picture below can never overlap it.
  let py = drawMissionPanel(y + 12*U);

  py += 16*U;
  ctx.fillStyle = 'rgba(90,170,220,0.75)';
  ctx.font = `bold ${9*U}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('TACTICAL PICTURE', x + 10*U, py);
  ctx.strokeStyle = 'rgba(70,140,190,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 8*U, py + 7*U);
  ctx.lineTo(x + w - 8*U, py + 7*U);
  ctx.stroke();
  py += 26*U;

  // Clip so nothing below can spill out of the column
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, py - 18*U, w, Math.max(0, H - BOTH - (py - 18*U)));
  ctx.clip();
  const lx = x + 12;

  // Sensor status
  ctx.fillStyle = 'rgba(120,170,205,0.55)'; ctx.font = `${9*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.fillText('SENSORS', lx, py); py += 13*HUD_S;
  ctx.fillStyle = '#30d158'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText('● SPY-1D  RADIATING', lx, py); py += 12*HUD_S;
  ctx.fillStyle = 'rgba(140,185,215,0.5)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.fillText(`Horizon vs VLCC:  ${sensors.horizonNm(32).toFixed(1)} nm`, lx, py); py += 10*HUD_S;
  ctx.fillText(`Horizon vs skiff: ${sensors.horizonNm(3).toFixed(1)} nm`, lx, py); py += 14*HUD_S;
  if (helo && helo.airborne) {
    ctx.fillStyle = '#7fd0ff'; ctx.font = `${9*HUD_S}px monospace`;
    ctx.fillText(`● MH-60R   ${helo.state}`, lx, py); py += 11*HUD_S;
    ctx.fillStyle = 'rgba(140,200,240,0.5)'; ctx.font = `${8*HUD_S}px monospace`;
    const hd = Math.hypot(helo.x - own.x, helo.y - own.y);
    ctx.fillText(`Reach ${helo.horizonNm(20).toFixed(0)} nm  ·  ${hd.toFixed(1)} nm out`, lx, py);
    py += 10*HUD_S;
    // Fuel bar
    const fw = w - 24*HUD_S, fp = helo.fuelPct;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(lx, py, fw, 4*HUD_S);
    ctx.fillStyle = fp < 0.25 ? '#ff6b5e' : fp < 0.5 ? '#ffaa00' : '#4ef09a';
    ctx.fillRect(lx, py, fw * fp, 4*HUD_S);
    py += 8*HUD_S;
    ctx.fillStyle = helo._bingo ? '#ff6b5e' : 'rgba(130,180,215,0.45)';
    ctx.font = `${8*HUD_S}px monospace`;
    ctx.fillText(helo._bingo ? 'BINGO FUEL — RETURNING' :
      `MODE ${helo.mode}  ·  ORBIT ${helo.orbitNm} nm`, lx, py);
    py += 12*HUD_S;
    ctx.fillStyle = 'rgba(120,165,200,0.4)';
    ctx.font = `${7.5*HUD_S}px monospace`;
    ctx.fillText('J vector  K follow  L hold  O orbit  U sprint  H recall', lx, py);
    py += 14*HUD_S;
  } else {
    ctx.fillStyle = 'rgba(140,185,215,0.4)'; ctx.font = `${9*HUD_S}px monospace`;
    ctx.fillText('○ MH-60R   ON DECK', lx, py); py += 10*HUD_S;
    ctx.fillStyle = 'rgba(120,165,200,0.4)'; ctx.font = `${8*HUD_S}px monospace`;
    ctx.fillText('[H] launch — extends reach to 80 nm', lx, py); py += 14*HUD_S;
  }
  ctx.fillStyle = 'rgba(140,185,215,0.3)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText('○ AWACS    UNAVAILABLE', lx, py); py += 16*HUD_S;

  ctx.strokeStyle = 'rgba(70,140,190,0.18)';
  ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(x + w - 12, py); ctx.stroke();
  py += 14*HUD_S;

  // Contact list
  const held = sensors.contacts.filter(c => c.held || c.state > 0);
  ctx.fillStyle = 'rgba(90,170,220,0.75)'; ctx.font = `bold ${9*HUD_S}px monospace`;
  ctx.letterSpacing = '1.5px';
  ctx.fillText(`CONTACTS  (${held.length})`, lx, py);
  ctx.letterSpacing = '0px';
  py += 14*HUD_S;

  for (const c of held) {
    if (py > h + TOPBAR - 40) break;
    const isSel = c === selectedContact;
    const col = c.knowsType ? factionColor(c.ship.faction) : '#ffd60a';
    const rh = 42;
    if (isSel) {
      ctx.fillStyle = 'rgba(77,166,255,0.10)';
      ctx.fillRect(x + 6, py - 3, w - 12, rh);
      ctx.strokeStyle = 'rgba(77,166,255,0.55)';
      ctx.strokeRect(x + 6.5, py - 2.5, w - 13, rh - 1);
    }
    ctx.fillStyle = col;
    ctx.fillRect(x + 6, py - 3, 3, rh);

    // Track number + designation
    ctx.fillStyle = col; ctx.font = `bold ${10*HUD_S}px monospace`; ctx.textAlign = 'left';
    ctx.fillText(c.trackNum ? `TRK ${c.trackNum}` : 'UNK ---', lx, py + 7);
    ctx.fillStyle = c.held ? 'rgba(48,209,88,0.8)' : 'rgba(255,159,10,0.8)';
    ctx.font = `${7*HUD_S}px monospace`; ctx.textAlign = 'right';
    ctx.fillText(c.held ? 'HELD' : 'FADED', x + w - 12, py + 7);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,238,250,0.85)'; ctx.font = `${9*HUD_S}px monospace`;
    ctx.fillText(c.displayName.slice(0, 24), lx, py + 19);

    // Bearing / range
    const dx = c.dx - own.x, dy = c.dy - own.y;
    const brg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const rng = Math.hypot(dx, dy);
    ctx.fillStyle = 'rgba(130,175,210,0.55)'; ctx.font = `${8*HUD_S}px monospace`;
    let line = `BRG ${String(Math.round(brg)).padStart(3,'0')}  RNG ${rng.toFixed(1)}nm`;
    if (c.knowsCourse) line += `  CRS ${String(Math.round(c.lhdg)).padStart(3,'0')} ${c.lspd.toFixed(0)}kt`;
    ctx.fillText(line, lx, py + 30);

    // Classification progress bar
    if (c.state < TRACK_STATE.IDENTIFIED && c.held) {
      const pw = w - 26, pb = py + 34;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(lx, pb, pw, 3);
      ctx.fillStyle = c.focused ? '#4ef09a' : 'rgba(90,170,220,0.6)';
      ctx.fillRect(lx, pb, pw * c.progress, 3);
      if (c.focused) {
        ctx.fillStyle = '#4ef09a'; ctx.font = `${7*HUD_S}px monospace`; ctx.textAlign = 'right';
        ctx.fillText('FOCUSED', x + w - 12, py + 30);
        ctx.textAlign = 'left';
      }
    }
    py += rh + 3;
  }

  if (!held.length) {
    ctx.fillStyle = 'rgba(110,150,180,0.4)'; ctx.font = `${9*HUD_S}px monospace`;
    ctx.fillText('No contacts held.', lx, py);
  }
  ctx.restore();
}

function drawBottomBar() {
  const y = H - BOTH;
  ctx.fillStyle = 'rgba(4,12,22,0.96)';
  ctx.fillRect(LEFTW, y, W - LEFTW, BOTH);
  ctx.strokeStyle = 'rgba(70,140,190,0.3)';
  ctx.beginPath(); ctx.moveTo(LEFTW, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();

  ctx.fillStyle = 'rgba(90,170,220,0.6)'; ctx.font = `bold ${8*HUD_S}px monospace`;
  ctx.textAlign = 'left'; ctx.letterSpacing = '1.5px';
  ctx.fillText('CIC LOG', LEFTW + 14, y + 15);
  ctx.letterSpacing = '0px';

  let ly = y + 29;
  for (let i = 0; i < Math.min(4, msgs.length); i++) {
    const m = msgs[i];
    const cols = { ok: '#4ef09a', warn: '#ff9f0a', alert: '#ff453a', info: 'rgba(180,215,240,0.7)' };
    const fade = i === 0 ? 1 : 0.55 - i * 0.10;
    ctx.globalAlpha = Math.max(0.28, fade);
    ctx.fillStyle = cols[m.kind] || cols.info;
    ctx.font = `${10*HUD_S}px monospace`;
    ctx.fillText(m.text, LEFTW + 14, ly);
    ctx.globalAlpha = 1;
    ly += 13;
  }

  // Controls hint
  ctx.fillStyle = 'rgba(100,145,180,0.35)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.textAlign = 'right';
  ctx.fillText('HOVER 0.5s designate  ·  SPACE fire  ·  V single/double  ·  X clear  ·  Z/C/B/G weapons  ·  T drill  ·  R-CLICK steer  ·  WHEEL zoom  ·  W/S speed', W - 14, y + 66);
}

// ── MAP OVERLAYS ──────────────────────────────────────────────
function drawContacts() {
  for (const c of sensors.contacts) {
    if (!c.held && c.state === TRACK_STATE.UNKNOWN) continue;
    const x = cam.nm2sx(c.dx, W), y = cam.nm2sy(c.dy, H);
    if (x < LEFTW - 40 || x > W - RIGHTW + 40 || y < TOPBAR - 40 || y > H - BOTH + 40) continue;

    const known = c.knowsType;
    const fac = known ? c.ship.faction : 'unknown';
    const col = factionColor(fac);

    // Draw the actual vessel if we're zoomed in and hold the contact
    if (c.held && cam.pxPerNm >= LOD_SYMBOL) {
      const ghost = { ...c.ship, faction: fac };
      drawShip(ctx, ghost, x, y, cam.pxPerNm);
    } else {
      drawNatoSymbol(ctx, { faction: fac, speed: c.knowsCourse ? c.lspd : 0, hdg: c.lhdg }, x, y, {});
    }

    // Faded contacts get a dashed "last known" marker
    if (!c.held) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,159,10,0.55)';
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,159,10,0.6)'; ctx.font = `${7*HUD_S}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('LAST KNOWN', x, y + 26);
      ctx.restore();
    }

    // Selection brackets
    if (c === selectedContact) {
      ctx.save();
      ctx.strokeStyle = '#4da6ff'; ctx.lineWidth = 1.6;
      const R = 20, arm = 7;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sxg, syg]) => {
        ctx.beginPath();
        ctx.moveTo(x + sxg*R, y + syg*R - syg*arm);
        ctx.lineTo(x + sxg*R, y + syg*R);
        ctx.lineTo(x + sxg*R - sxg*arm, y + syg*R);
        ctx.stroke();
      });
      ctx.restore();
    }

    // Label
    if (cam.pxPerNm > 10) {
      ctx.save();
      ctx.font = `${9*HUD_S}px monospace`; ctx.textAlign = 'left';
      const label = c.trackNum ? `${c.trackNum}` : '?';
      const sub = known ? c.displayName : 'UNKNOWN';
      ctx.fillStyle = 'rgba(4,12,24,0.75)';
      const tw = Math.max(ctx.measureText(sub).width, 26) + 8;
      ctx.fillRect(x + 14, y - 16, tw, 24);
      ctx.fillStyle = col;
      ctx.font = `bold ${9*HUD_S}px monospace`;
      ctx.fillText(label, x + 18, y - 6);
      ctx.fillStyle = 'rgba(210,232,248,0.75)';
      ctx.font = `${8*HUD_S}px monospace`;
      ctx.fillText(sub, x + 18, y + 4);
      ctx.restore();
    }
  }
}

function drawOwnshipOverlay() {
  const x = cam.nm2sx(own.x, W), y = cam.nm2sy(own.y, H);

  // Range rings — radar horizon + selected weapon envelope
  const rings = [];
  rings.push({ nm: sensors.horizonNm(32), col: 'rgba(48,209,88,0.18)', dash: [6,6], label: `RADAR HORIZON ${sensors.horizonNm(32).toFixed(0)}nm` });
  if (selectedWeapon) {
    const M = own.mag;
    const wp = M.weapons[selectedWeapon] || (selectedWeapon === 'gun' ? M.gun :
               selectedWeapon === 'torpedo' ? M.torpedo :
               selectedWeapon === 'ciws' ? M.ciws : null);
    if (wp && wp.rangeNm) {
      rings.push({ nm: wp.rangeNm, col: `rgba(${hexToRgb(wp.col)},0.7)`, width: 1.6, label: `${wp.short}  ${wp.rangeNm} nm` });
      // Filled envelope
      const rad = wp.rangeNm * cam.pxPerNm;
      if (rad < Math.max(W,H) * 3) {
        ctx.save();
        ctx.fillStyle = `rgba(${hexToRgb(wp.col)},0.05)`;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }
  drawRangeRings(ctx, cam, W, H, own.x, own.y, rings);

  // Ordered-heading marker
  if (Math.abs(own.ordHdg - own.hdg) > 0.5) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,60,0.5)';
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
    const rad = own.ordHdg * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(rad) * 90, y - Math.cos(rad) * 90);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Velocity vector — projected 6 minutes ahead
  if (own.speed > 0.5) {
    const rad = own.hdg * Math.PI / 180;
    const projNm = own.speed * 0.1; // 6 min
    ctx.save();
    ctx.strokeStyle = 'rgba(77,166,255,0.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(rad) * projNm * cam.pxPerNm, y - Math.cos(rad) * projNm * cam.pxPerNm);
    ctx.stroke();
    ctx.restore();
  }
}

function drawVectorCursor() {
  if (!heloVectorMode || !inMapArea(mouseX, mouseY)) return;
  const p = 0.5 + Math.sin(t * 0.15) * 0.5;
  ctx.save();
  ctx.strokeStyle = `rgba(127,208,255,${0.6 + p * 0.4})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(mouseX, mouseY, 16 + p * 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouseX - 22, mouseY); ctx.lineTo(mouseX - 8, mouseY);
  ctx.moveTo(mouseX + 8, mouseY); ctx.lineTo(mouseX + 22, mouseY);
  ctx.moveTo(mouseX, mouseY - 22); ctx.lineTo(mouseX, mouseY - 8);
  ctx.moveTo(mouseX, mouseY + 8); ctx.lineTo(mouseX, mouseY + 22);
  ctx.stroke();
  ctx.fillStyle = '#7fd0ff';
  ctx.font = `bold ${10*HUD_S}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('VECTOR SEAHAWK', mouseX, mouseY - 30);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawCursorInfo() {
  if (!inMapArea(mouseX, mouseY)) return;
  const nx = cam.sx2nm(mouseX, W), ny = cam.sy2nm(mouseY, H);
  const dx = nx - own.x, dy = ny - own.y;
  const brg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  const rng = Math.hypot(dx, dy);

  ctx.save();
  // Bearing line from ownship
  const ox = cam.nm2sx(own.x, W), oy = cam.nm2sy(own.y, H);
  ctx.strokeStyle = 'rgba(120,180,220,0.18)';
  ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(mouseX, mouseY); ctx.stroke();
  ctx.setLineDash([]);

  // Readout box
  const lines = [
    fmtLatLon(nx, ny),
    `BRG ${String(Math.round(brg)).padStart(3,'0')}°   RNG ${rng.toFixed(2)} nm`,
    `DEPTH ${depthAt(nx, ny).toFixed(0)} m`
  ];
  ctx.font = `${9*HUD_S}px monospace`;
  const bw2 = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14;
  const bx = Math.min(mouseX + 16, W - RIGHTW - bw2 - 6);
  const by = Math.min(mouseY + 16, H - BOTH - 52);
  ctx.fillStyle = 'rgba(4,14,26,0.88)';
  ctx.fillRect(bx, by, bw2, 44);
  ctx.strokeStyle = 'rgba(70,140,190,0.35)';
  ctx.strokeRect(bx + 0.5, by + 0.5, bw2 - 1, 43);
  ctx.fillStyle = 'rgba(190,220,245,0.8)';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, bx + 7, by + 14 + i * 12));
  ctx.restore();
}

// ── RENDER ────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  // Clip to the map viewport so the world never paints over the panels
  ctx.save();
  ctx.beginPath();
  ctx.rect(LEFTW, TOPBAR, W - LEFTW - RIGHTW, H - TOPBAR - BOTH);
  ctx.clip();

  drawOcean(ctx, cam, W, H, simSeconds);
  drawGraticule(ctx, cam, W, H);
  drawTSS(ctx, cam, W, H);
  drawLand(ctx, cam, W, H);

  for (const s of ships) drawWake(ctx, cam, W, H, s);

  drawSearchGrid();
  drawScenarioEntities();
  drawHeloSelection();
  drawOwnshipOverlay();
  drawContacts();

  // Weapons layer
  drawSmoke(ctx, cam, W, H, fc.smokeField);
  drawThreats(ctx, cam, W, H, board, fc, hoverThreat);
  drawInterceptors(ctx, cam, W, H, fc);
  if (strike) drawStrike(ctx, cam, W, H, strike);
  if (helo) drawHelo(ctx, cam, W, H, helo);

  // Ownship on top
  const ox = cam.nm2sx(own.x, W), oy = cam.nm2sy(own.y, H);
  drawShip(ctx, own, ox, oy, cam.pxPerNm);

  drawBlasts(ctx, cam, W, H, fc);
  drawCursorInfo();
  drawVectorCursor();
  drawScaleBar(ctx, cam, W, H, LEFTW + 20, H - BOTH - 16);
  ctx.restore();


  drawAlarmOverlay();

  drawTopBar();
  drawLeftPanel();
  drawRightPanel();
  drawBottomBar();
  drawHeloPanel();
  drawDecisionPanel();
  drawSurvivalClock();
  drawScenarioPrompt();
  drawThreatStrip();
  drawFiringSolution();
  drawDrillPanel();
}

function hexToRgb(h) {
  return `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
}

// ═══════════════════════════════════════════════════════════════
//  BOOT — App state machine drives everything
// ═══════════════════════════════════════════════════════════════
resize();
App.init();

// Route input through App first; tactical only sees it when active
cv.addEventListener('mousedown', e => {
  App.onMouseDown(e.clientX, e.clientY, e.button);
});
window.addEventListener('mouseup', () => App.onMouseUp());
cv.addEventListener('mousemove', e => {
  App.onMouseMove(e.clientX, e.clientY, W, H);
});

let _fpsAcc = 0, _fpsN = 0;

const PERF = { show: false, hist: new Array(180).fill(0), i: 0, worst: 0 };
let FATAL = null;

(function loop() {
  try {
    const now = performance.now();
    const rawDt = (now - App.lastReal) / 1000;   // true frame time
    App.lastReal = now;
    const realDt = Math.min(0.05, rawDt);        // clamped for simulation

    // FPS must use the RAW delta. Using the clamped value reports
    // a healthy framerate even when frames are taking a second.
    PERF.hist[PERF.i] = rawDt * 1000;
    PERF.i = (PERF.i + 1) % PERF.hist.length;
    if (rawDt * 1000 > PERF.worst) PERF.worst = rawDt * 1000;

    _fpsAcc += rawDt; _fpsN++;
    if (_fpsAcc >= 0.5) {
      App.fps = _fpsN / _fpsAcc;
      App.frameMs = (_fpsAcc / _fpsN) * 1000;
      _fpsAcc = 0; _fpsN = 0;
    }

    if (FATAL) { drawFatal(); requestAnimationFrame(loop); return; }

    App.update(realDt);
    MusicSys.update(realDt);

    if (App.screen === SCREEN.TACTICAL) {
      if (!own) initWorld();
      update();
      render();
      drawTacticalExitHint();
    } else {
      App.render(ctx, W, H);
    }
    if (PERF.show) drawPerf();
  } catch (err) {
    if (!FATAL) {
      FATAL = err;
      console.error('FATAL in game loop:', err);
    }
    try { drawFatal(); } catch (e) {}
  }
  requestAnimationFrame(loop);
})();

// F3 — frame time graph. If the picture stutters but this stays
// flat and low, the bottleneck is the GPU or compositor, not JS.
function drawPerf() {
  const pw = 260, ph = 108, px = W - pw - 14, py = 54;
  ctx.save();
  ctx.fillStyle = 'rgba(4,10,20,0.9)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(90,150,200,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  // Budget guides
  const gy = v => py + ph - 22 - Math.min(1, v / 40) * (ph - 34);
  [[16.7, 'rgba(255,200,60,0.35)', '60'], [6.1, 'rgba(80,220,140,0.35)', '165']]
    .forEach(([ms, col, lbl]) => {
      const y = gy(ms);
      ctx.strokeStyle = col;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(px + 4, y); ctx.lineTo(px + pw - 26, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = `${8*HUD_S}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(lbl, px + pw - 22, y + 3);
    });

  // History
  const n = PERF.hist.length, step = (pw - 30) / n;
  ctx.beginPath();
  for (let j = 0; j < n; j++) {
    const v = PERF.hist[(PERF.i + j) % n];
    const x = px + 4 + j * step, y = gy(v);
    j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#4da6ff'; ctx.lineWidth = 1.2; ctx.stroke();

  const avg = PERF.hist.reduce((a, b) => a + b, 0) / n;
  ctx.fillStyle = 'rgba(190,220,245,0.85)'; ctx.font = `bold ${10*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(App.fps)} fps`, px + 8, py + 15);
  ctx.fillStyle = 'rgba(140,180,215,0.6)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText(`avg ${avg.toFixed(1)}ms   peak ${PERF.worst.toFixed(0)}ms`, px + 68, py + 15);
  ctx.fillStyle = 'rgba(110,150,185,0.45)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.fillText(`${W}x${H} @ ${(RENDER_DPR||1).toFixed(2)}x  =  ${((W*RENDER_DPR*H*RENDER_DPR)/1e6).toFixed(1)}MP`,
               px + 8, py + ph - 8);
  ctx.restore();
}

// A crash must never be a silent black screen.
function drawFatal() {
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff4d4d';
  ctx.font = `bold ${22*HUD_S}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('GAME LOOP ERROR', 40, 60);
  ctx.fillStyle = '#ffb3b3';
  ctx.font = `${14*HUD_S}px monospace`;
  ctx.fillText(String(FATAL && FATAL.message || FATAL), 40, 92);
  ctx.fillStyle = 'rgba(255,190,190,0.55)';
  ctx.font = `${11*HUD_S}px monospace`;
  const lines = String((FATAL && FATAL.stack) || '').split('\n').slice(0, 14);
  let y = 124;
  for (const l of lines) { ctx.fillText(l.trim().slice(0, 150), 40, y); y += 15; }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `${12*HUD_S}px monospace`;
  ctx.fillText('Press F12 for the console, or F5 to reload.', 40, y + 20);
}

// Catch anything that escapes the loop entirely
window.addEventListener('error', e => {
  if (!FATAL) { FATAL = e.error || new Error(e.message); }
});
window.addEventListener('keydown', e => {
  if (e.key === 'F5') location.reload();
});

function drawTacticalExitHint() {
  const U = HUD_S;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(90,130,165,0.30)';
  ctx.font = `${9*U}px monospace`;
  ctx.fillText('SHIFT+ESC — ABORT TO CHART', 14*U, H - 6*U);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(90,130,165,0.25)';
  ctx.fillText(`${Math.round(App.fps)} fps`, W - 14*U, H - 6*U);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  WEAPONS UI — alarm, firing solution, drill sandbox
// ═══════════════════════════════════════════════════════════════

function drawAlarmOverlay() {
  if (!alarmActive) return;
  const pulse = 0.5 + Math.sin(alarmFlash) * 0.5;

  // Red vignette around the map viewport
  const mx0 = LEFTW, my0 = TOPBAR, mw = W - LEFTW - RIGHTW, mh = H - TOPBAR - BOTH;
  ctx.save();
  const g = ctx.createLinearGradient(mx0, my0, mx0, my0 + mh);
  g.addColorStop(0, `rgba(255,40,30,${0.13 * pulse})`);
  g.addColorStop(0.16, 'rgba(255,40,30,0)');
  g.addColorStop(0.84, 'rgba(255,40,30,0)');
  g.addColorStop(1, `rgba(255,40,30,${0.13 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(mx0, my0, mw, mh);
  // Side bars
  const g2 = ctx.createLinearGradient(mx0, 0, mx0 + mw, 0);
  g2.addColorStop(0, `rgba(255,40,30,${0.11 * pulse})`);
  g2.addColorStop(0.13, 'rgba(255,40,30,0)');
  g2.addColorStop(0.87, 'rgba(255,40,30,0)');
  g2.addColorStop(1, `rgba(255,40,30,${0.11 * pulse})`);
  ctx.fillStyle = g2;
  ctx.fillRect(mx0, my0, mw, mh);
  ctx.strokeStyle = `rgba(255,50,40,${0.35 + pulse * 0.45})`;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(mx0 + 1, my0 + 1, mw - 2, mh - 2);
  ctx.restore();

  // Banner
  const n = board.inboundCount;
  const tti = board.soonestTTI();
  const bw = 340, bx = mx0 + mw / 2 - bw / 2, by = my0 + 12;
  ctx.save();
  ctx.fillStyle = `rgba(70,8,6,${0.82 + pulse * 0.12})`;
  ctx.fillRect(bx, by, bw, 46);
  ctx.strokeStyle = `rgba(255,60,50,${0.6 + pulse * 0.4})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, 44);
  ctx.fillStyle = `rgba(255,${90 + pulse * 60},80,1)`;
  ctx.font = `bold ${15*HUD_S}px monospace`; ctx.textAlign = 'center';
  ctx.fillText('⚠  VAMPIRE  VAMPIRE  VAMPIRE  ⚠', bx + bw / 2, by + 20);
  ctx.fillStyle = 'rgba(255,190,180,0.92)';
  ctx.font = `bold ${11*HUD_S}px monospace`;
  const ttiStr = tti !== null ? `IMPACT ${tti.toFixed(0)}s` : '';
  ctx.fillText(`${n} INBOUND        ${ttiStr}`, bx + bw / 2, by + 37);
  ctx.restore();
}

function drawFiringSolution() {
  if (!fc || !fc.weapon) return;
  const E = ENGAGE[fc.weapon];
  const mx0 = LEFTW, mw = W - LEFTW - RIGHTW;
  const bw = 300, bx = mx0 + mw / 2 - bw / 2, by = H - BOTH - 74;

  ctx.save();
  ctx.fillStyle = 'rgba(6,18,30,0.93)';
  ctx.fillRect(bx, by, bw, 62);
  ctx.strokeStyle = `rgba(${hexToRgb(E.col)},0.75)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 61);
  ctx.fillStyle = E.col;
  ctx.fillRect(bx, by, 4, 62);

  // Weapon + doctrine
  ctx.fillStyle = E.col;
  ctx.font = `bold ${12*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.fillText(E.short, bx + 14, by + 18);
  ctx.fillStyle = fc.doubleSalvo ? '#ff9f0a' : 'rgba(150,190,220,0.6)';
  ctx.font = `bold ${9*HUD_S}px monospace`;
  ctx.fillText(fc.doubleSalvo ? 'DOUBLE  [V]' : 'SINGLE  [V]', bx + 70, by + 18);

  // Lock slots
  const cap = fc.cap;
  const slotW = 26, sx0 = bx + 14;
  for (let i = 0; i < cap; i++) {
    const filled = i < fc.locked.length;
    const sx = sx0 + i * (slotW + 4);
    ctx.fillStyle = filled ? `rgba(${hexToRgb('#30d158')},0.22)` : 'rgba(255,255,255,0.04)';
    ctx.fillRect(sx, by + 26, slotW, 20);
    ctx.strokeStyle = filled ? '#30d158' : 'rgba(90,140,180,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, by + 26.5, slotW - 1, 19);
    if (filled) {
      ctx.fillStyle = '#30d158'; ctx.font = `bold ${8*HUD_S}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('V' + String(fc.locked[i].trackNum).slice(-2), sx + slotW / 2, by + 39);
    }
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(140,185,215,0.55)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.fillText(`${fc.locked.length}/${cap} DESIGNATED`, sx0 + cap * (slotW + 4) + 6, by + 33);

  const rounds = fc.locked.length * (fc.doubleSalvo ? 2 : 1);
  ctx.fillStyle = 'rgba(140,185,215,0.45)';
  ctx.fillText(`${rounds} round${rounds !== 1 ? 's' : ''}`, sx0 + cap * (slotW + 4) + 6, by + 43);

  // FIRE button
  const ready = fc.locked.length > 0;
  const fbx = bx + bw - 82, fby = by + 12, fbw = 68, fbh = 38;
  const fpulse = 0.5 + Math.sin(performance.now() / 130) * 0.5;
  ctx.fillStyle = ready ? `rgba(255,50,40,${0.18 + fpulse * 0.22})` : 'rgba(60,70,80,0.2)';
  ctx.fillRect(fbx, fby, fbw, fbh);
  ctx.strokeStyle = ready ? `rgba(255,70,60,${0.6 + fpulse * 0.4})` : 'rgba(80,95,110,0.35)';
  ctx.lineWidth = ready ? 2 : 1;
  ctx.strokeRect(fbx + 0.5, fby + 0.5, fbw - 1, fbh - 1);
  ctx.fillStyle = ready ? '#ff6b5e' : 'rgba(110,130,150,0.5)';
  ctx.font = `bold ${13*HUD_S}px monospace`; ctx.textAlign = 'center';
  ctx.fillText('FIRE', fbx + fbw / 2, fby + 20);
  ctx.font = `${7*HUD_S}px monospace`;
  ctx.fillText('[SPACE]', fbx + fbw / 2, fby + 31);
  ctx.restore();

  if (ready) uiButtons.push({ x: fbx, y: fby, w: fbw, h: fbh, grp: 'fire',
    act: () => { for (const l of fc.fire(own.mag)) pushMsg(l, 'alert'); } });

  // Hint
  if (!fc.locked.length) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,214,10,0.55)'; ctx.font = `${9*HUD_S}px monospace`; ctx.textAlign = 'center';
    ctx.fillText('HOLD CURSOR ON A VAMPIRE FOR 0.5s TO DESIGNATE', bx + bw / 2, by - 6);
    ctx.restore();
  }
}

function drawDrillPanel() {
  if (!drillOpen) return;
  const pw = 250, ph = 268;
  const px = LEFTW + 18, py = TOPBAR + 18;
  ctx.save();
  ctx.fillStyle = 'rgba(6,18,30,0.96)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(255,159,10,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.fillStyle = '#ff9f0a';
  ctx.font = `bold ${10*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('WEAPONS DRILL  [T]', px + 12, py + 18);
  ctx.letterSpacing = '0px';
  ctx.strokeStyle = 'rgba(255,159,10,0.25)';
  ctx.beginPath(); ctx.moveTo(px + 10, py + 25); ctx.lineTo(px + pw - 10, py + 25); ctx.stroke();

  let y = py + 38;
  ctx.fillStyle = 'rgba(150,190,220,0.5)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.fillText('Spawn inbound missiles to practise.', px + 12, y); y += 16;

  const waves = [
    { n: 1,  m: 0.85, label: '1  ·  single, subsonic',  col: '#30d158' },
    { n: 4,  m: 0.9,  label: '4  ·  small salvo',       col: '#5ac8fa' },
    { n: 8,  m: 0.9,  label: '8  ·  raid',              col: '#ffd60a' },
    { n: 16, m: 1.1,  label: '16 ·  heavy raid',        col: '#ff9f0a' },
    { n: 50, m: 0.95, label: '50 ·  SATURATION',        col: '#ff453a' },
    { n: 6,  m: 2.5,  label: '6  ·  SUPERSONIC M2.5',   col: '#bf5af2' }
  ];
  for (const wv of waves) {
    const bh = 26;
    ctx.fillStyle = `rgba(${hexToRgb(wv.col)},0.10)`;
    ctx.fillRect(px + 12, y, pw - 24, bh);
    ctx.strokeStyle = `rgba(${hexToRgb(wv.col)},0.45)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 12.5, y + 0.5, pw - 25, bh - 1);
    ctx.fillStyle = wv.col;
    ctx.fillRect(px + 12, y, 3, bh);
    ctx.fillStyle = wv.col; ctx.font = `bold ${9*HUD_S}px monospace`;
    ctx.fillText(wv.label, px + 22, y + 16);
    uiButtons.push({ x: px + 12, y, w: pw - 24, h: bh, grp: 'drill',
      act: () => {
        Audio.uiClick();
        board.spawnWave(wv.n, { mach: wv.m, rangeNm: 26, stagger: wv.n > 20 ? 1.1 : 2.4,
                                spread: wv.n > 8 ? 90 : 45 });
        pushMsg(`DRILL: ${wv.n} inbound spawned at Mach ${wv.m}.`, 'warn');
      }});
    y += bh + 4;
  }

  y += 4;
  const cbh = 24;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(px + 12, y, pw - 24, cbh);
  ctx.strokeStyle = 'rgba(120,160,200,0.35)';
  ctx.strokeRect(px + 12.5, y + 0.5, pw - 25, cbh - 1);
  ctx.fillStyle = 'rgba(180,215,240,0.8)'; ctx.font = `${9*HUD_S}px monospace`;
  ctx.fillText('CLEAR ALL  ·  RELOAD MAGAZINE', px + 22, y + 15);
  uiButtons.push({ x: px + 12, y, w: pw - 24, h: cbh, grp: 'drill',
    act: () => {
      Audio.uiClick();
      board.threats = []; fc.interceptors = []; fc.clear();
      own.mag = freshMagazine();
      board.killed = 0; board.leakers = 0; lastLeakers = 0;
      pushMsg('DRILL RESET — magazine reloaded.', 'ok');
    }});
  y += cbh + 8;

  // Score
  ctx.fillStyle = 'rgba(150,190,220,0.5)'; ctx.font = `${8*HUD_S}px monospace`;
  ctx.fillText(`KILLS ${board.killed}    LEAKERS ${board.leakers}    INBOUND ${board.inboundCount}`, px + 12, y);
  ctx.restore();
}

function drawThreatStrip() {
  // Compact inbound list on the right panel, above contacts
  if (!board || !board.inboundCount) return;
  const rx = W - RIGHTW, x = rx + 12, w = RIGHTW - 24;
  let y = H - BOTH - 8;
  const list = board.detectedThreats
    .slice()
    .sort((a, b) => a.ttiSec(own) - b.ttiSec(own))
    .slice(0, 8);
  y -= list.length * 16 + 22;

  ctx.save();
  ctx.fillStyle = 'rgba(50,6,6,0.92)';
  ctx.fillRect(rx + 6, y - 4, RIGHTW - 12, list.length * 16 + 26);
  ctx.strokeStyle = 'rgba(255,69,58,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 6.5, y - 3.5, RIGHTW - 13, list.length * 16 + 25);
  ctx.fillStyle = '#ff6b5e'; ctx.font = `bold ${9*HUD_S}px monospace`; ctx.textAlign = 'left';
  ctx.fillText(`INBOUND  (${board.inboundCount})`, x, y + 10);
  y += 22;
  for (const t of list) {
    const tti = t.ttiSec(own);
    const urgent = tti < 25;
    const isLocked = fc.locked.includes(t);
    ctx.fillStyle = isLocked ? '#30d158' : urgent ? '#ff453a' : 'rgba(255,150,140,0.8)';
    ctx.font = `${urgent ? 'bold ' : ''}9px monospace`;
    ctx.fillText(`V${t.trackNum}`, x, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = urgent ? '#ff453a' : 'rgba(200,170,165,0.7)';
    ctx.fillText(`${tti.toFixed(0)}s`, x + w - 44, y);
    ctx.fillStyle = t.engagedBy ? '#5ac8fa' : 'rgba(140,110,110,0.6)';
    ctx.fillText(t.engagedBy ? `◄${t.engagedBy}` : '—', x + w, y);
    ctx.textAlign = 'left';
    y += 16;
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  SCENARIO HUD — objectives, prompts, search grid
// ═══════════════════════════════════════════════════════════════
// Draws the mission block and RETURNS the y it finished at, so the
// tactical picture can start below it instead of guessing.
function drawMissionPanel(startY) {
  if (!SCEN) return startY;
  const U = HUD_S;
  const rx = W - RIGHTW, x = rx + 10*U, w = RIGHTW - 20*U;
  let y = startY;

  const G = gameCtx();
  const g = SCEN.guidance ? SCEN.guidance(G) : null;
  const rows = SCEN.objectives.filter(o => !o.hidden);

  // Measure the wrapped body first so the frame is the right size
  ctx.font = `${9*U}px monospace`;
  const bodyLines = g ? countWrapped(ctx, g.body, w - 26*U) : 0;
  const keyRows = g && g.keys ? g.keys.length : 0;
  const h = 74*U + rows.length*20*U +
            (g ? (34*U + (g.stat ? 15*U : 0) + bodyLines*13*U + 10*U + keyRows*15*U) : 0) + 12*U;

  ctx.save();
  ctx.fillStyle = 'rgba(5,16,30,0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,190,60,0.35)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
  ctx.fillStyle = 'rgba(255,190,60,0.8)';
  ctx.fillRect(x, y, 3*U, h);

  let py = y + 16*U;
  const lx = x + 12*U;
  ctx.textAlign = 'left';

  // Mission title + status
  ctx.fillStyle = 'rgba(255,200,80,0.75)';
  ctx.font = `bold ${9*U}px monospace`;
  ctx.fillText('MISSION', lx, py);
  const stat = SCEN.statusLine ? SCEN.statusLine(G) : '';
  if (stat) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(180,215,240,0.55)';
    ctx.font = `${8.5*U}px monospace`;
    ctx.fillText(stat, x + w - 12*U, py);
    ctx.textAlign = 'left';
  }
  py += 16*U;
  ctx.fillStyle = '#e9f4ff';
  ctx.font = `bold ${13*U}px monospace`;
  ctx.fillText(SCEN.mission ? SCEN.mission.name : 'OPERATION', lx, py);
  py += 16*U;

  ctx.strokeStyle = 'rgba(255,190,60,0.18)';
  ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(x + w - 12*U, py); ctx.stroke();
  py += 16*U;

  // Objectives
  for (const o of rows) {
    ctx.fillStyle = o.done ? '#4ef09a' : 'rgba(120,165,200,0.5)';
    ctx.font = `${10*U}px monospace`;
    ctx.fillText(o.done ? '✓' : '○', lx, py);
    ctx.fillStyle = o.done ? 'rgba(140,200,170,0.6)' : 'rgba(210,232,248,0.85)';
    ctx.font = `${9.5*U}px monospace`;
    let txt = o.text;
    if (o.progress) txt += `  ${o.progress.cur}/${o.progress.max}`;
    wrapClip(ctx, txt, lx + 18*U, py, w - 40*U);
    py += 20*U;
  }

  if (!g) { ctx.restore(); return y + h + 10*U; }

  py += 6*U;
  ctx.strokeStyle = 'rgba(255,190,60,0.18)';
  ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(x + w - 12*U, py); ctx.stroke();
  py += 18*U;

  // What to do right now
  const pulse = 0.75 + Math.sin(t * 0.05) * 0.25;
  ctx.fillStyle = `rgba(255,214,10,${pulse})`;
  ctx.font = `bold ${11*U}px monospace`;
  ctx.fillText('▸ ' + g.heading, lx, py);
  py += 16*U;

  if (g.stat) {
    ctx.fillStyle = 'rgba(127,208,255,0.75)';
    ctx.font = `${9*U}px monospace`;
    ctx.fillText(g.stat, lx, py);
    py += 15*U;
  }

  ctx.fillStyle = 'rgba(185,215,240,0.65)';
  ctx.font = `${9*U}px monospace`;
  py = wrapLines(ctx, g.body, lx, py, w - 26*U, 13*U);
  py += 10*U;

  // Key hints
  for (const [k, desc] of (g.keys || [])) {
    ctx.fillStyle = 'rgba(255,214,10,0.7)';
    ctx.font = `bold ${8.5*U}px monospace`;
    ctx.fillText(k, lx, py);
    ctx.fillStyle = 'rgba(150,190,220,0.5)';
    ctx.font = `${8.5*U}px monospace`;
    ctx.fillText(desc, lx + 78*U, py);
    py += 15*U;
  }
  ctx.restore();

  // Objective marker on the chart
  if (g.marker) drawObjectiveMarker(g.marker);
  return y + h + 10*U;
}

// How many lines a string wraps to at a given width
function countWrapped(ctx, text, maxW) {
  const words = String(text || '').split(' ');
  let line = '', n = 1;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) { n++; line = w + ' '; }
    else line = test;
  }
  return n;
}

// Highlight where the player should actually go
function drawObjectiveMarker(m) {
  const sx = cam.nm2sx(m.x, W), sy = cam.nm2sy(m.y, H);
  const r = Math.max(14, m.r * cam.pxPerNm);
  const pulse = 0.5 + Math.sin(t * 0.05) * 0.5;
  ctx.save();
  ctx.strokeStyle = `rgba(255,214,10,${0.30 + pulse*0.35})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 7]);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(255,214,10,${0.05 + pulse*0.04})`;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();

  // Off-screen arrow so you never lose it
  const inView = sx > LEFTW && sx < W-RIGHTW && sy > TOPBAR && sy < H-BOTH;
  if (!inView) {
    const cx = LEFTW + (W-LEFTW-RIGHTW)/2, cy = TOPBAR + (H-TOPBAR-BOTH)/2;
    const a = Math.atan2(sy-cy, sx-cx);
    const rad = Math.min((W-LEFTW-RIGHTW), (H-TOPBAR-BOTH)) * 0.40;
    const ax = cx + Math.cos(a)*rad, ay = cy + Math.sin(a)*rad;
    ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = `rgba(255,214,10,${0.6+pulse*0.4})`;
    ctx.beginPath();
    ctx.moveTo(16,0); ctx.lineTo(-8,9); ctx.lineTo(-3,0); ctx.lineTo(-8,-9);
    ctx.closePath(); ctx.fill();
    ctx.rotate(-a);
    ctx.fillStyle = 'rgba(255,214,10,0.8)';
    ctx.font = `bold ${9*HUD_S}px monospace`;
    ctx.textAlign = 'center';
    const d = Math.hypot(m.x-own.x, m.y-own.y);
    ctx.fillText(`${m.label}  ${d.toFixed(1)} nm`, 0, -16);
  } else if (r > 26) {
    ctx.fillStyle = `rgba(255,214,10,${0.5+pulse*0.3})`;
    ctx.font = `bold ${9*HUD_S}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(m.label, sx, sy - r - 8);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function wrapClip(ctx, text, x, y, maxW) {
  let t2 = text;
  while (ctx.measureText(t2).width > maxW && t2.length > 4) t2 = t2.slice(0, -2);
  if (t2 !== text) t2 = t2.slice(0, -1) + '…';
  ctx.fillText(t2, x, y);
}

function wrapLines(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trimEnd(), x, y); y += lh; line = w + ' ';
    } else line = test;
  }
  if (line.trim()) { ctx.fillText(line.trimEnd(), x, y); y += lh; }
  return y;
}

function drawScenarioPrompt() {
  if (!SCEN || !SCEN.activePrompt) return;
  const U = HUD_S;
  const p = SCEN.activePrompt;
  const fade = Math.min(1, SCEN.promptT * 3) * Math.min(1, (6.5 - SCEN.promptT) * 1.5);
  if (fade <= 0) return;
  const mw = W - LEFTW - RIGHTW;
  const cx = LEFTW + mw / 2;
  const y = TOPBAR + 90 * U;

  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(4,14,26,0.9)';
  const bw = 520 * U, bh = 64 * U;
  ctx.fillRect(cx - bw / 2, y, bw, bh);
  ctx.strokeStyle = 'rgba(255,214,10,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - bw / 2, y, bw, bh);
  ctx.fillStyle = '#ffd60a';
  ctx.font = `bold ${15 * U}px monospace`;
  ctx.fillText(p.text, cx, y + 26 * U);
  if (p.sub) {
    ctx.fillStyle = 'rgba(210,232,248,0.7)';
    ctx.font = `${11 * U}px monospace`;
    ctx.fillText(p.sub, cx, y + 47 * U);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

// Search grid for the SAR scenario
function drawSearchGrid() {
  if (!SCEN || !SCEN.searchCells || !SCEN.searchCells.length) return;
  ctx.save();
  for (const c of SCEN.searchCells) {
    const x = cam.nm2sx(c.x, W), y = cam.nm2sy(c.y, H);
    const s = c.w * cam.pxPerNm;
    if (x + s < LEFTW || x > W - RIGHTW || y + s < TOPBAR || y > H - BOTH) continue;

    if (c.searched) {
      ctx.fillStyle = 'rgba(40,60,80,0.28)';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = 'rgba(90,130,170,0.35)';
    } else {
      // Heat by probability
      const p = c.prob;
      ctx.fillStyle = `rgba(255,${Math.round(200 - p * 150)},40,${0.05 + p * 0.14})`;
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = `rgba(255,${Math.round(200 - p * 120)},60,${0.35 + p * 0.4})`;
    }
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, s, s);

    if (s > 46) {
      ctx.fillStyle = c.searched ? 'rgba(120,160,195,0.45)' : 'rgba(255,220,150,0.65)';
      ctx.font = `bold ${Math.min(14, s * 0.13)}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(c.label, x + 6, y + 16);
      if (!c.searched) {
        ctx.fillStyle = 'rgba(255,200,120,0.4)';
        ctx.font = `${Math.min(10, s * 0.09)}px monospace`;
        ctx.fillText(`${Math.round(c.prob * 100)}%`, x + 6, y + 30);
      }
    }
  }

  // Datum markers
  if (SCEN.datum) {
    const dx = cam.nm2sx(SCEN.datum.x, W), dy = cam.nm2sy(SCEN.datum.y, H);
    ctx.strokeStyle = 'rgba(150,180,210,0.5)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(dx, dy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(150,180,210,0.6)';
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('REPORTED', dx, dy - 18);
  }
  if (SCEN.drifted) {
    const dx = cam.nm2sx(SCEN.drifted.x, W), dy = cam.nm2sy(SCEN.drifted.y, H);
    const pulse = 0.5 + Math.sin(t * 0.06) * 0.5;
    ctx.strokeStyle = `rgba(255,180,60,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(dx, dy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dx - 6, dy); ctx.lineTo(dx + 6, dy);
    ctx.moveTo(dx, dy - 6); ctx.lineTo(dx, dy + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,190,90,0.85)';
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('DRIFTED DATUM', dx, dy - 20);
    // Drift arrow
    if (SCEN.datum) {
      const sx = cam.nm2sx(SCEN.datum.x, W), sy = cam.nm2sy(SCEN.datum.y, H);
      ctx.strokeStyle = 'rgba(255,180,60,0.3)';
      ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Hoist progress ring
  if (SCEN.found && SCEN.survivor && SCEN.hoist > 0 && !SCEN.recovered) {
    const hx = cam.nm2sx(SCEN.survivor.x, W), hy = cam.nm2sy(SCEN.survivor.y, H);
    ctx.strokeStyle = 'rgba(78,240,154,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, 22, -Math.PI/2, -Math.PI/2 + SCEN.hoist * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#4ef09a';
    ctx.font = `bold ${9*HUD_S}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${SCEN.hoistBy || ''} ${Math.round(SCEN.hoist*100)}%`, hx, hy + 36);
    ctx.textAlign = 'left';
  }

  // Survivor once found
  if (SCEN.found && SCEN.survivor && !SCEN.recovered) {
    const sx = cam.nm2sx(SCEN.survivor.x, W), sy = cam.nm2sy(SCEN.survivor.y, H);
    const pulse = 0.5 + Math.sin(t * 0.2) * 0.5;
    ctx.strokeStyle = `rgba(80,240,160,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(sx, sy, 10 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#4ef09a';
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SURVIVOR', sx, sy - 22);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

// Survival clock for SAR
function drawSurvivalClock() {
  if (!SCEN || SCEN.survivalMin === undefined) return;
  const U = HUD_S;
  const mw = W - LEFTW - RIGHTW;
  const cx = LEFTW + mw / 2;
  const y = TOPBAR + 14 * U;
  const mins = Math.max(0, SCEN.survivalMin);
  const urgent = mins < 60;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(4,14,26,0.88)';
  ctx.fillRect(cx - 150 * U, y, 300 * U, 44 * U);
  ctx.strokeStyle = urgent ? 'rgba(255,80,60,0.6)' : 'rgba(70,140,190,0.35)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(cx - 150 * U, y, 300 * U, 44 * U);
  ctx.fillStyle = urgent ? 'rgba(255,120,100,0.8)' : 'rgba(110,160,200,0.6)';
  ctx.font = `${9 * U}px monospace`;
  ctx.fillText('ESTIMATED SURVIVAL TIME REMAINING', cx, y + 15 * U);
  ctx.fillStyle = urgent ? '#ff6b5e' : '#e8f2fa';
  ctx.font = `bold ${19 * U}px monospace`;
  const hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
  ctx.fillText(`${hh}h ${String(mm).padStart(2, '0')}m`, cx, y + 36 * U);
  ctx.restore();
  ctx.textAlign = 'left';
}

// ═══════════════════════════════════════════════════════════════
//  AVIATION CONTROL PANEL
//  The keybinds worked but nobody could find them. This puts the
//  aircraft on screen with buttons you can actually click.
// ═══════════════════════════════════════════════════════════════
let heloBtns = [];

function drawHeloPanel() {
  if (!helo) return;
  const U = HUD_S;
  const pw = 300 * U;
  const px = LEFTW + 16 * U;
  const airborne = helo.airborne;
  const ph = airborne ? 160 * U : 74 * U;
  const py = H - BOTH - ph - 14 * U;

  heloBtns = [];

  ctx.save();
  ctx.fillStyle = 'rgba(4,14,26,0.94)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = airborne ? 'rgba(127,208,255,0.5)' : 'rgba(70,140,190,0.3)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.fillStyle = airborne ? '#7fd0ff' : 'rgba(90,140,180,0.5)';
  ctx.fillRect(px, py, 3 * U, ph);

  // Header
  ctx.textAlign = 'left';
  ctx.fillStyle = airborne ? '#7fd0ff' : 'rgba(120,165,200,0.6)';
  ctx.font = `bold ${10 * U}px monospace`;
  ctx.fillText('AVIATION  ·  SEAHAWK 01', px + 12 * U, py + 18 * U);
  ctx.textAlign = 'right';
  ctx.fillStyle = airborne ? 'rgba(160,215,245,0.7)' : 'rgba(110,150,185,0.5)';
  ctx.font = `${9 * U}px monospace`;
  ctx.fillText(helo.state, px + pw - 12 * U, py + 18 * U);
  ctx.textAlign = 'left';

  // Draw a small top-down Seahawk so it is obvious what this is
  drawHeloGlyph(ctx, px + pw - 34 * U, py + 40 * U, 26 * U,
                airborne ? '#7fd0ff' : 'rgba(110,150,185,0.4)');

  let by = py + 30 * U;

  if (!airborne) {
    ctx.fillStyle = 'rgba(150,190,220,0.55)';
    ctx.font = `${9 * U}px monospace`;
    ctx.fillText('On deck. Extends sensor reach to 80 nm.', px + 12 * U, by + 8 * U);
    heloBtns.push(heloButton(px + 12 * U, by + 18 * U, 130 * U, 26 * U,
      'LAUNCH  [H]', '#4ef09a', true, () => {
        const rad = own.hdg * Math.PI / 180;
        helo.launch({ x: own.x + Math.sin(rad) * 18, y: own.y - Math.cos(rad) * 18 });
        pushMsg('AIR: Seahawk 01 launching.', 'ok');
        Audio.weaponSelect();
      }));
    ctx.restore();
    return;
  }

  // ── FUEL ──
  const fp = helo.fuelPct;
  ctx.fillStyle = 'rgba(120,165,200,0.5)';
  ctx.font = `${8 * U}px monospace`;
  ctx.fillText('FUEL', px + 12 * U, by);
  const fbw = pw - 90 * U;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(px + 46 * U, by - 7 * U, fbw, 8 * U);
  ctx.fillStyle = fp < 0.25 ? '#ff6b5e' : fp < 0.5 ? '#ffaa00' : '#4ef09a';
  ctx.fillRect(px + 46 * U, by - 7 * U, fbw * fp, 8 * U);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 46 * U, by - 7 * U, fbw, 8 * U);
  ctx.textAlign = 'right';
  ctx.fillStyle = fp < 0.25 ? '#ff6b5e' : 'rgba(180,215,240,0.7)';
  ctx.font = `${8.5 * U}px monospace`;
  ctx.fillText(`${Math.round(fp * 100)}%`, px + pw - 12 * U, by);
  ctx.textAlign = 'left';
  by += 16 * U;

  if (helo._bingo) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = `bold ${9 * U}px monospace`;
    ctx.fillText('BINGO FUEL — RETURNING TO THE SHIP', px + 12 * U, by);
    by += 14 * U;
  } else {
    const d = Math.hypot(helo.x - own.x, helo.y - own.y);
    ctx.fillStyle = 'rgba(140,190,225,0.55)';
    ctx.font = `${8.5 * U}px monospace`;
    ctx.fillText(`${d.toFixed(1)} nm out  ·  reach ${helo.horizonNm(20).toFixed(0)} nm  ·  orbit ${helo.orbitNm} nm`,
                 px + 12 * U, by);
    by += 14 * U;
  }

  // ── HOW TO MOVE IT ──
  ctx.fillStyle = heloSelected ? 'rgba(127,208,255,0.85)' : 'rgba(140,185,215,0.5)';
  ctx.font = `${8.5 * U}px monospace`;
  ctx.fillText(heloSelected
    ? '▸ SELECTED — click the chart to send it there'
    : 'Click the aircraft on the chart to select it',
    px + 12 * U, by);
  by += 14 * U;

  // ── ORDERS ──
  const bw = (pw - 36 * U) / 3, bh = 26 * U;
  const row1 = [
    { label: 'FOLLOW SHIP', col: '#4ef09a',
      act: () => { helo.followShip(); heloSelected = false;
        pushMsg('AIR: Shadowing the ship.', 'ok'); },
      on: helo.mode === 'FOLLOW' },
    { label: 'HOLD HERE', col: '#7fd0ff',
      act: () => { helo.holdHere(); heloSelected = false;
        pushMsg('AIR: Holding position.', 'ok'); },
      on: helo.mode === 'HOLD' },
    { label: 'RECALL', col: '#ff6b5e',
      act: () => { helo.recall(); heloSelected = false;
        pushMsg('AIR: Seahawk 01 returning.', 'info'); },
      on: helo.state === 'RETURNING' }
  ];
  row1.forEach((mo, i) => {
    heloBtns.push(heloButton(px + 12 * U + i * (bw + 6 * U), by, bw, bh,
      mo.label, mo.col, true, mo.act, mo.on));
  });
  by += bh + 6 * U;

  const row2 = [
    { label: `ORBIT ${helo.orbitNm} nm`, col: '#9bb8cc',
      act: () => { const st = [1,2,4,6,9];
        const i = st.findIndex(v => v >= helo.orbitNm);
        helo.setOrbit(st[(i + 1) % st.length]);
        pushMsg(`AIR: Orbit radius ${helo.orbitNm} nm.`, 'info'); }, on: false },
    { label: helo.mode === 'SPRINT' ? 'CRUISE' : 'SPRINT', col: '#ff9f0a',
      act: () => { const on = helo.mode !== 'SPRINT'; helo.sprint(on);
        pushMsg(on ? 'AIR: Maximum speed — fuel burn increased.'
                   : 'AIR: Back to cruise.', on ? 'warn' : 'info'); },
      on: helo.mode === 'SPRINT' },
    { label: heloSelected ? 'DESELECT' : 'SELECT', col: '#ffd60a',
      act: () => { heloSelected = !heloSelected;
        pushMsg(heloSelected ? 'AIR: Seahawk 01 selected.'
                             : 'AIR: Seahawk 01 deselected.', 'info'); },
      on: heloSelected }
  ];
  row2.forEach((mo, i) => {
    heloBtns.push(heloButton(px + 12 * U + i * (bw + 6 * U), by, bw, bh,
      mo.label, mo.col, true, mo.act, mo.on));
  });

  ctx.restore();
}

function heloButton(x, y, w, h, label, col, enabled, act, active) {
  const U = HUD_S;
  ctx.fillStyle = active ? `rgba(${hexToRgb(col)},0.20)`
                : enabled ? 'rgba(255,255,255,0.035)' : 'rgba(30,35,45,0.4)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = active ? col
                  : enabled ? `rgba(${hexToRgb(col)},0.35)` : 'rgba(60,70,85,0.3)';
  ctx.lineWidth = active ? 1.6 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = active ? col : enabled ? `rgba(${hexToRgb(col)},0.85)` : 'rgba(90,105,120,0.5)';
  ctx.font = `${active ? 'bold ' : ''}${8.5 * U}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 3 * U);
  ctx.textAlign = 'left';
  return { x, y, w, h, act: enabled ? act : null };
}

// Small top-down Seahawk for the panel header
function drawHeloGlyph(ctx, cx, cy, S, col) {
  ctx.save();
  ctx.translate(cx, cy);
  const L = S;
  ctx.fillStyle = col;
  // Fuselage
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.36);
  ctx.quadraticCurveTo(L * 0.14, -L * 0.30, L * 0.15, -L * 0.16);
  ctx.lineTo(L * 0.15, L * 0.10);
  ctx.lineTo(-L * 0.15, L * 0.10);
  ctx.lineTo(-L * 0.15, -L * 0.16);
  ctx.quadraticCurveTo(-L * 0.14, -L * 0.30, 0, -L * 0.36);
  ctx.closePath(); ctx.fill();
  // Tail boom
  ctx.fillRect(-L * 0.045, L * 0.08, L * 0.09, L * 0.34);
  ctx.fillRect(-L * 0.14, L * 0.34, L * 0.28, L * 0.045);
  // Rotor disc
  const spin = (performance.now() / 60) % (Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const a = spin + i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.04);
    ctx.lineTo(Math.cos(a) * L * 0.52, -L * 0.04 + Math.sin(a) * L * 0.52);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  ctx.beginPath(); ctx.arc(0, -L * 0.04, L * 0.52, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  HELO: SELECT AND CLICK
//  Click the aircraft to select it, then click the water to send
//  it there. Everything else is a button.
// ═══════════════════════════════════════════════════════════════
function launchHelo() {
  if (!helo || helo.airborne) return;
  // Lift off and hold alongside. It does NOT go anywhere until told.
  helo.launch(null);
  helo.mode = 'HOLD';
  helo.station = { x: own.x, y: own.y };
  heloSelected = true;
  pushMsg('AIR: Seahawk 01 airborne and holding alongside.', 'ok');
  pushMsg('AIR: It is selected. Click anywhere on the chart to send it there.', 'info');
  Audio.weaponSelect();
}

// Is the cursor over the aircraft?
function heloHitTest(mx, my) {
  if (!helo || !helo.airborne) return false;
  const hx = cam.nm2sx(helo.x, W), hy = cam.nm2sy(helo.y, H);
  const r = Math.max(18, Math.min(46, cam.pxPerNm * 0.018));
  return Math.hypot(mx - hx, my - hy) < r;
}

// Selection ring and waypoint line
function drawHeloSelection() {
  if (!helo || !helo.airborne) return;
  const hx = cam.nm2sx(helo.x, W), hy = cam.nm2sy(helo.y, H);
  const hover = heloHitTest(mouseX, mouseY);

  if (heloSelected || hover) {
    const p = 0.5 + Math.sin(t * 0.06) * 0.5;
    const r = Math.max(20, Math.min(52, cam.pxPerNm * 0.020));
    ctx.save();
    ctx.strokeStyle = heloSelected
      ? `rgba(127,208,255,${0.65 + p * 0.35})`
      : 'rgba(127,208,255,0.35)';
    ctx.lineWidth = heloSelected ? 2 : 1.4;
    // Corner brackets rather than a circle — reads as "selected"
    const b = r * 0.42;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(hx + sx * r, hy + sy * r - sy * b);
      ctx.lineTo(hx + sx * r, hy + sy * r);
      ctx.lineTo(hx + sx * r - sx * b, hy + sy * r);
      ctx.stroke();
    });
    if (heloSelected) {
      ctx.fillStyle = 'rgba(127,208,255,0.85)';
      ctx.font = `bold ${9 * HUD_S}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('SELECTED', hx, hy - r - 8);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  // Line to the ordered waypoint
  if (helo.station && helo.mode !== 'FOLLOW') {
    const sx = cam.nm2sx(helo.station.x, W), sy = cam.nm2sy(helo.station.y, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(127,208,255,0.30)';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.setLineDash([]);
    // Waypoint diamond
    ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(127,208,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
  }

  // Cursor feedback while selected
  if (heloSelected && inMapArea(mouseX, mouseY) && !heloHitTest(mouseX, mouseY)) {
    ctx.save();
    const p = 0.5 + Math.sin(t * 0.12) * 0.5;
    ctx.strokeStyle = `rgba(127,208,255,${0.45 + p * 0.35})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mouseX, mouseY, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX - 16, mouseY); ctx.lineTo(mouseX - 6, mouseY);
    ctx.moveTo(mouseX + 6, mouseY);  ctx.lineTo(mouseX + 16, mouseY);
    ctx.moveTo(mouseX, mouseY - 16); ctx.lineTo(mouseX, mouseY - 6);
    ctx.moveTo(mouseX, mouseY + 6);  ctx.lineTo(mouseX, mouseY + 16);
    ctx.stroke();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SCENARIO ENTITIES — skiffs, escorted vessels, cargo, the site
// ═══════════════════════════════════════════════════════════════
function drawScenarioEntities() {
  if (!SCEN) return;

  // ── PROTECTED VESSEL ──
  const v = SCEN.victim || SCEN.charge;
  if (v) {
    const x = cam.nm2sx(v.x, W), y = cam.nm2sy(v.y, H);
    const L = Math.max(10, Math.min(260, cam.pxPerNm * (v.type === 'supertanker' ? 0.18 : 0.132)));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(v.hdg * Math.PI / 180);
    if (typeof drawVehicle !== 'function' ||
        !drawVehicle(ctx, v.type, L, '#4ef09a', { speed: v.speed })) {
      ctx.fillStyle = '#4ef09a';
      ctx.fillRect(-L * 0.07, -L * 0.5, L * 0.14, L);
    }
    ctx.restore();

    // Boarding progress — the thing you are actually racing
    const pct = v.boardingPct || 0;
    if (pct > 0) {
      const bw = 90 * HUD_S;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - bw / 2, y - L * 0.5 - 26 * HUD_S, bw, 7 * HUD_S);
      ctx.fillStyle = pct > 0.7 ? '#ff453a' : pct > 0.4 ? '#ffaa00' : '#4ef09a';
      ctx.fillRect(x - bw / 2, y - L * 0.5 - 26 * HUD_S, bw * pct, 7 * HUD_S);
      ctx.fillStyle = pct > 0.7 ? '#ff6b5e' : 'rgba(200,230,250,0.8)';
      ctx.font = `bold ${8 * HUD_S}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`BOARDING ${Math.round(pct * 100)}%`, x, y - L * 0.5 - 32 * HUD_S);
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = 'rgba(78,240,154,0.85)';
    ctx.font = `bold ${9 * HUD_S}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(v.name, x, y + L * 0.5 + 16 * HUD_S);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // ── SKIFFS ──
  if (SCEN.skiffs) {
    for (const s of SCEN.skiffs) {
      const x = cam.nm2sx(s.x, W), y = cam.nm2sy(s.y, H);
      const L = Math.max(7, Math.min(60, cam.pxPerNm * 0.0049));
      const col = s.dead ? '#5a6470'
                : s.state === 'BREAKING OFF' ? '#ffaa00' : '#ff453a';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.hdg * Math.PI / 180);
      if (typeof drawVehicle !== 'function' ||
          !drawVehicle(ctx, 'skiff', L, col, { speed: s.dead ? 0 : s.speed })) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, -L * 0.5); ctx.lineTo(L * 0.22, L * 0.4);
        ctx.lineTo(-L * 0.22, L * 0.4); ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      if (!s.dead && cam.pxPerNm > 12) {
        ctx.save();
        const p = 0.5 + Math.sin(t * 0.14) * 0.5;
        ctx.strokeStyle = `rgba(255,69,58,${0.3 + p * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-L * 0.6, -L * 0.6, L * 1.2, L * 1.2);
        ctx.restore();
      }
      if (cam.pxPerNm > 26) {
        ctx.save();
        ctx.fillStyle = s.dead ? 'rgba(120,130,145,0.6)' : col;
        ctx.font = `${8 * HUD_S}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(s.dead ? 'DISABLED' : String(s.trackNum), x, y - L * 0.7);
        ctx.restore();
      }
    }
    ctx.textAlign = 'left';
  }

  // ── CARGO: supply ship and drop zone ──
  if (SCEN.supply && SCEN.island) {
    [[SCEN.supply, 'SUPPLY SHIP', '#5ac8fa'],
     [SCEN.island, 'DROP ZONE',   '#4ef09a']].forEach(([pt, label, col]) => {
      const x = cam.nm2sx(pt.x, W), y = cam.nm2sy(pt.y, H);
      const p = 0.5 + Math.sin(t * 0.05) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(${col === '#5ac8fa' ? '90,200,250' : '78,240,154'},${0.4 + p * 0.4})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.font = `bold ${8.5 * HUD_S}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 24);
      ctx.restore();
    });
    ctx.textAlign = 'left';
    // Winch progress
    if (SCEN.load > 0 && helo) {
      const hx = cam.nm2sx(helo.x, W), hy = cam.nm2sy(helo.y, H);
      ctx.save();
      ctx.strokeStyle = '#4ef09a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy, 24, -Math.PI / 2, -Math.PI / 2 + SCEN.load * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#4ef09a';
      ctx.font = `bold ${9 * HUD_S}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${SCEN.loadMode} ${Math.round(SCEN.load * 100)}%`, hx, hy + 38);
      ctx.restore();
      ctx.textAlign = 'left';
    }
    if (SCEN.carrying && helo && helo.airborne) {
      const hx = cam.nm2sx(helo.x, W), hy = cam.nm2sy(helo.y, H);
      ctx.save();
      ctx.fillStyle = '#ffd60a';
      ctx.fillRect(hx - 5, hy + 14, 10, 8);
      ctx.strokeStyle = 'rgba(255,214,10,0.5)';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + 14); ctx.stroke();
      ctx.restore();
    }
  }

  // ── LAUNCH SITE ──
  if (SCEN.launchSite && SCEN.siteFound) {
    const x = cam.nm2sx(SCEN.launchSite.x, W), y = cam.nm2sy(SCEN.launchSite.y, H);
    const p = 0.5 + Math.sin(t * 0.08) * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(255,69,58,${0.55 + p * 0.45})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, 20 + p * 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 28, y); ctx.lineTo(x - 12, y);
    ctx.moveTo(x + 12, y); ctx.lineTo(x + 28, y);
    ctx.moveTo(x, y - 28); ctx.lineTo(x, y - 12);
    ctx.moveTo(x, y + 12); ctx.lineTo(x, y + 28);
    ctx.stroke();
    ctx.fillStyle = '#ff453a';
    ctx.font = `bold ${10 * HUD_S}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('COASTAL LAUNCH SITE', x, y - 36);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

// ── THE DECISION PANEL ────────────────────────────────────────
let decideBtns = [];
function drawDecisionPanel() {
  decideBtns = [];
  if (!SCEN || SCEN.phase !== 'DECIDE' || SCEN.decision) return;
  const U = HUD_S;
  const mw = W - LEFTW - RIGHTW;
  const cx = LEFTW + mw / 2;
  const pw = 620 * U, ph = 190 * U;
  const px = cx - pw / 2, py = H - BOTH - ph - 40 * U;

  ctx.save();
  ctx.fillStyle = 'rgba(6,14,26,0.96)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(255,214,10,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = `bold ${15 * U}px monospace`;
  ctx.fillText('COASTAL LAUNCH SITE LOCATED', cx, py + 26 * U);
  ctx.fillStyle = 'rgba(200,228,248,0.7)';
  ctx.font = `${10 * U}px monospace`;
  ctx.fillText('Prepared position. Transporter erector. Additional rounds on the ground.',
               cx, py + 46 * U);

  const bw = (pw - 60 * U) / 2, bh = 92 * U;
  const opts = [
    { id: 'report', col: '#5ac8fa', title: 'REPORT IT  [R]',
      l1: 'Pass the position to CTF 150', l2: 'and continue the escort.',
      l3: 'Somebody else decides.' },
    { id: 'strike', col: '#ff9f0a', title: 'TOMAHAWK IT  [T]',
      l1: 'Destroy it now. Two rounds.', l2: 'A private vessel striking',
      l3: 'a land target. No precedent.' }
  ];
  opts.forEach((o, i) => {
    const bx = px + 20 * U + i * (bw + 20 * U), by = py + 62 * U;
    const p = 0.5 + Math.sin(t * 0.06 + i) * 0.5;
    ctx.fillStyle = `rgba(${hexToRgb(o.col)},${0.07 + p * 0.06})`;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = `rgba(${hexToRgb(o.col)},${0.55 + p * 0.35})`;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = o.col;
    ctx.font = `bold ${13 * U}px monospace`;
    ctx.fillText(o.title, bx + bw / 2, by + 24 * U);
    ctx.fillStyle = 'rgba(200,225,245,0.7)';
    ctx.font = `${9.5 * U}px monospace`;
    ctx.fillText(o.l1, bx + bw / 2, by + 45 * U);
    ctx.fillText(o.l2, bx + bw / 2, by + 60 * U);
    ctx.fillText(o.l3, bx + bw / 2, by + 75 * U);
    decideBtns.push({ x: bx, y: by, w: bw, h: bh, id: o.id });
  });
  ctx.restore();
  ctx.textAlign = 'left';
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO — fully synthesized. No sample files.
//  Web Audio API oscillators, filtered noise, and envelopes.
// ═══════════════════════════════════════════════════════════════

const Audio = {
  ctx: null,
  master: null,
  enabled: true,
  volume: 0.55,
  ready: false,
  _busy: [],          // release timestamps
  _maxVoices: 44,
  _alarmTimer: 0,
  _alarmPhase: 0,
  _alarmOn: false,
  _flightNodes: [],

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      // Gentle limiter so a 50-missile salvo doesn't clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 9;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.ready = true;
    } catch (e) {
      this.enabled = false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  },

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopAlarm();
    return this.enabled;
  },

  // priority: 2 = always (alarm, lock, leaker)
  //            1 = important (intercept, fire)
  //            0 = ambient (launch roar, ticks) — dropped first
  _ok(priority = 1) {
    if (!this.enabled) return false;
    if (!this.ctx) this.init();
    if (!this.ready) return false;
    this._prune();
    const n = this._busy.length;
    if (priority >= 2) return n < this._maxVoices + 12;  // headroom reserved
    if (priority === 1) return n < this._maxVoices;
    return n < this._maxVoices * 0.62;                    // ambient yields first
  },

  _prune() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (let i = this._busy.length - 1; i >= 0; i--) {
      if (this._busy[i] <= now) this._busy.splice(i, 1);
    }
  },

  _voice(node, dur) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    this._busy.push(now + dur + 0.08);
  },

  get _voices() { this._prune(); return this._busy.length; },

  // ── PRIMITIVES ──────────────────────────────────────────────

  // Pitched oscillator with envelope and optional glide
  tone(freq, dur, opts = {}) {
    if (!this._ok(opts.pri !== undefined ? opts.pri : 1)) return;
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.glide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glide), t0 + dur);
    }
    const vol = (opts.vol !== undefined ? opts.vol : 1) * 0.5;
    const atk = opts.attack !== undefined ? opts.attack : 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let last = o;
    if (opts.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.filterFreq || 900;
      if (opts.q) f.Q.value = opts.q;
      o.connect(f); last = f;
    }
    last.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    this._voice(o, dur + (opts.delay || 0));
  },

  // Filtered noise burst
  noise(dur, opts = {}) {
    if (!this._ok(opts.pri !== undefined ? opts.pri : 1)) return;
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const sr = this.ctx.sampleRate;
    const len = Math.max(64, Math.floor(sr * dur));
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const curve = opts.curve !== undefined ? opts.curve : 1.8;
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const f = this.ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    const f0 = opts.freq || 900;
    f.frequency.setValueAtTime(f0, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqTo), t0 + dur);
    if (opts.q) f.Q.value = opts.q;

    const g = this.ctx.createGain();
    g.gain.value = (opts.vol !== undefined ? opts.vol : 1) * 0.5;

    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
    this._voice(src, dur + (opts.delay || 0));
  },

  // ── ALARM ───────────────────────────────────────────────────
  // Two-tone naval air-action klaxon. Called every frame while
  // threats are inbound; it schedules its own repeats.
  updateAlarm(dt, active, urgency) {
    if (!this.enabled || !active) {
      this._alarmOn = false;
      return;
    }
    if (!this.ctx) this.init();
    if (!this.ready) return;

    this._alarmOn = true;
    // Faster cadence as time-to-impact shrinks
    const period = urgency > 0.6 ? 0.34 : urgency > 0.3 ? 0.46 : 0.62;
    this._alarmTimer -= dt;
    if (this._alarmTimer <= 0) {
      this._alarmTimer = period;
      this._alarmPhase = 1 - this._alarmPhase;
      const hi = this._alarmPhase === 0;
      const base = hi ? 740 : 560;
      const v = 0.30 + urgency * 0.22;
      // Klaxon body — square wave through a bandpass gives it bite
      this.tone(base, period * 0.72, {
        type: 'square', vol: v * 0.5, pri: 2,
        filter: 'bandpass', filterFreq: base * 1.5, q: 2.2
      });
      this.tone(base * 0.5, period * 0.72, { type: 'sawtooth', vol: v * 0.28, pri: 2 });
      this.tone(base * 2.02, period * 0.35, { type: 'sine', vol: v * 0.12, pri: 0 });
    }
  },

  stopAlarm() { this._alarmOn = false; this._alarmTimer = 0; },

  // ── DESIGNATION ─────────────────────────────────────────────
  // Subtle tick while the acquisition ring closes.
  lockTick(progress) {
    if (!this._ok(0)) return;
    const f = 900 + progress * 700;
    this.tone(f, 0.045, { type: 'square', vol: 0.10, attack: 0.002, pri: 0 });
  },

  // Confirmation — this is what tells you the target is yours.
  lockOn() {
    if (!this._ok(2)) return;
    // Rising two-note resolve — always audible, this is the confirmation
    this.tone(1180, 0.09, { type: 'sine', vol: 0.42, attack: 0.003, pri: 2 });
    this.tone(1760, 0.16, { type: 'sine', vol: 0.38, delay: 0.075, attack: 0.003, pri: 2 });
    this.tone(2640, 0.11, { type: 'sine', vol: 0.14, delay: 0.075, pri: 0 });
    this.noise(0.05, { freq: 4200, filter: 'highpass', vol: 0.10, delay: 0.07, pri: 0 });
  },

  lockRelease() {
    if (!this._ok(2)) return;
    this.tone(900, 0.09, { type: 'sine', vol: 0.25, glide: 520 });
  },

  lockFull() {
    if (!this._ok(2)) return;
    // "Solution complete" — three quick ascending pips
    [0, 0.06, 0.12].forEach((d, i) => {
      this.tone(1200 + i * 260, 0.055, { type: 'sine', vol: 0.30, delay: d, pri: 2 });
    });
  },

  // ── LAUNCH ──────────────────────────────────────────────────
  // Vertical launch: hatch, igniter crack, then the sustained roar.
  vlsLaunch(delay = 0) {
    if (!this._ok(1)) return;
    // Hatch / gas generator thump
    this.tone(64, 0.14, { type: 'sine', vol: 0.55, glide: 40, delay, pri: 1 });
    // Igniter crack
    this.noise(0.11, { freq: 3600, filter: 'highpass', vol: 0.34, delay: delay + 0.02, curve: 3.2, pri: 0 });
    // Booster roar — this is the body of the sound
    this.noise(0.85, {
      freq: 1500, freqTo: 260, filter: 'lowpass',
      vol: 0.60, delay: delay + 0.04, curve: 1.1, pri: 1
    });
    // Low-end thrust
    this.tone(112, 0.75, { type: 'sawtooth', vol: 0.30, glide: 52, delay: delay + 0.04,
                           filter: 'lowpass', filterFreq: 420, pri: 0 });
    // Doppler climb-out whistle
    this.tone(430, 0.62, { type: 'sine', vol: 0.14, glide: 1250, delay: delay + 0.22, pri: 0 });
  },

  gunFire() {
    if (!this._ok(1)) return;
    this.noise(0.30, { freq: 1900, freqTo: 210, filter: 'lowpass', vol: 0.72, curve: 2.4 });
    this.tone(88, 0.24, { type: 'square', vol: 0.48, glide: 42 });
    this.tone(178, 0.11, { type: 'sawtooth', vol: 0.20, glide: 70 });
  },

  ciwsBurst() {
    if (!this._ok(1)) return;
    // Phalanx buzzsaw — rapid pulses
    for (let i = 0; i < 12; i++) {
      this.noise(0.03, { freq: 2400, filter: 'bandpass', q: 1.6, vol: 0.22, delay: i * 0.022, pri: 0 });
    }
    this.tone(150, 0.28, { type: 'sawtooth', vol: 0.16, glide: 110 });
  },

  // ── IMPACT ──────────────────────────────────────────────────
  intercept() {
    if (!this._ok(1)) return;
    // Sharp crack of the warhead
    this.noise(0.07, { freq: 5200, filter: 'highpass', vol: 0.42, curve: 3.5 });
    // Main detonation
    this.noise(0.55, { freq: 1300, freqTo: 130, filter: 'lowpass', vol: 0.68, curve: 1.6 });
    this.tone(76, 0.40, { type: 'sine', vol: 0.52, glide: 34 });
    // Debris shimmer
    this.noise(0.34, { freq: 2600, filter: 'highpass', vol: 0.13, delay: 0.09, curve: 2.6, pri: 0 });
  },

  missShot() {
    if (!this._ok(1)) return;
    // Duller, hollow — the disappointing one
    this.noise(0.26, { freq: 620, freqTo: 160, filter: 'lowpass', vol: 0.26, curve: 2.2 });
    this.tone(132, 0.20, { type: 'sine', vol: 0.20, glide: 88 });
  },

  // A missile got through — this should feel bad.
  leaker() {
    if (!this._ok(2)) return;
    this.noise(0.10, { freq: 6000, filter: 'highpass', vol: 0.5, curve: 3.4 });
    this.noise(1.15, { freq: 900, freqTo: 60, filter: 'lowpass', vol: 0.88, curve: 1.2 });
    this.tone(52, 0.95, { type: 'sine', vol: 0.72, glide: 26, pri: 2 });
    this.tone(41, 1.25, { type: 'sine', vol: 0.48, glide: 20, delay: 0.06 });
    // Hull groan
    this.tone(96, 0.85, { type: 'sawtooth', vol: 0.18, glide: 62, delay: 0.15,
                          filter: 'lowpass', filterFreq: 300 });
  },

  // ── UI ──────────────────────────────────────────────────────
  uiClick() {
    if (!this._ok(2)) return;
    this.tone(1500, 0.028, { type: 'square', vol: 0.16, attack: 0.001 });
  },

  weaponSelect() {
    if (!this._ok(2)) return;
    // Mechanical relay clunk + arm tone
    this.noise(0.05, { freq: 2000, filter: 'bandpass', q: 2, vol: 0.22, curve: 3 });
    this.tone(560, 0.10, { type: 'square', vol: 0.20, glide: 840 });
  },

  fireCommand() {
    if (!this._ok(2)) return;
    // Firing key turn — descending authoritative pair
    this.tone(880, 0.07, { type: 'square', vol: 0.28 });
    this.tone(620, 0.12, { type: 'square', vol: 0.26, delay: 0.06 });
  },

  dryFire() {
    if (!this._ok(2)) return;
    // Empty magazine — dead click and a buzz
    this.noise(0.04, { freq: 1400, filter: 'bandpass', q: 3, vol: 0.28, curve: 4 });
    this.tone(180, 0.22, { type: 'square', vol: 0.20, glide: 120 });
  },

  newContact() {
    if (!this._ok(2)) return;
    this.tone(1320, 0.06, { type: 'sine', vol: 0.22 });
    this.tone(1760, 0.09, { type: 'sine', vol: 0.18, delay: 0.055 });
  },

  sonarPing() {
    if (!this._ok(1)) return;
    this.tone(1400, 0.42, { type: 'sine', vol: 0.26, attack: 0.004 });
    this.tone(1400, 0.30, { type: 'sine', vol: 0.10, delay: 0.30 });
  },

  threatClear() {
    if (!this._ok(2)) return;
    [660, 880, 1100].forEach((f, i) => {
      this.tone(f, 0.20, { type: 'sine', vol: 0.26, delay: i * 0.10 });
    });
  }
};

// Headless test export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Audio };
}

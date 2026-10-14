// ═══════════════════════════════════════════════════════════════
//  MUSIC — playback, crossfade, combat ducking
//  Tracks are optional. Missing files fall back silently.
// ═══════════════════════════════════════════════════════════════

// ── TRACK REGISTRY ────────────────────────────────────────────
// Drop files in assets/music/ and reference them here.
// Anything missing is skipped without error.
const TRACKS = {
  // ── MENU ──
  menu_legionnaire: {
    file: 'assets/music/menu/legionnaire.mp3',
    title: 'Legionnaire',
    composer: 'Scott Buckley',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://youtube.com/user/musicbyscottb',
    gain: 0.85
  },

  // ── SAILING ──
  sail_legionnaire: {
    file: 'assets/music/sailing/legionnaire.mp3',
    title: 'Legionnaire',
    composer: 'Scott Buckley',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://youtube.com/user/musicbyscottb',
    gain: 0.75
  }

  // ── TENSION ──  drop files in assets/music/tension/ and add here
  // ── ACTION ──   drop files in assets/music/action/ and add here
};

// ── PLAYLISTS ─────────────────────────────────────────────────
// Group tracks by mood. A screen picks a playlist and the system
// shuffles through it, advancing automatically when one ends.
// Any track whose file is missing is skipped without complaint.
// ── MUSIC STATES ──────────────────────────────────────────────
// One per folder in assets/music/. The tactical layer moves
// between sailing / tension / action on its own.
const PLAYLISTS = {
  menu:    ['menu_legionnaire'],   // menu, chart, briefing, credits
  sailing: ['sail_legionnaire'],   // under way, nothing detected
  tension: [],                     // contacts held, threat building
  action:  []                      // shooting
};

// Fall back to a quieter state if a folder is still empty, so an
// unfilled tension/ or action/ folder never means silence.
const PLAYLIST_FALLBACK = {
  action:  'tension',
  tension: 'sailing',
  sailing: 'menu',
  menu:    null
};

// Which state each screen uses. Tactical is dynamic — see
// MusicSys.updateIntensity.
const SCREEN_MUSIC = {
  menu:     'menu',
  intro:    'menu',
  globe:    'menu',
  transit:  'sailing',
  briefing: 'menu',
  debrief:  'menu',
  settings: 'menu',
  credits:  'menu',
  tactical: 'sailing'
};

const MusicSys = {
  enabled: true,
  volume: 0.45,
  current: null,        // track key
  playlist: null,       // resolved playlist actually playing
  requested: null,      // state the game asked for
  intensity: 'sailing',
  _intensityHold: 0,
  order: [],            // shuffled track keys for the active playlist
  orderIdx: 0,
  shuffle: true,
  el: null,             // active <audio>
  elB: null,            // outgoing element during a crossfade
  loaded: {},           // key -> HTMLAudioElement
  failed: {},
  fadeT: 0,
  fadeDur: 1.8,
  fading: false,
  duck: 1,              // 1 = normal, lower = ducked under combat
  duckTarget: 1,
  tacticalGain: 0.42,   // music sits well back during a mission
  inTactical: false,
  ready: false,

  init() {
    if (this.ready) return;
    this.ready = true;
    // Preload lazily — only what we actually reference
    for (const key of new Set(Object.values(SCREEN_MUSIC))) {
      if (key) this._load(key);
    }
  },

  _load(key) {
    if (this.loaded[key] || this.failed[key]) return this.loaded[key];
    const t = TRACKS[key];
    if (!t) { this.failed[key] = true; return null; }
    try {
      // NOTE: do not use `new Audio()`. The sound-effects object in
      // audio.js is also named Audio and shadows the browser
      // constructor at global scope, so `new Audio()` would try to
      // construct that object literal and throw.
      const a = document.createElement('audio');
      a.addEventListener('error', () => {
        this.failed[key] = true;
        console.warn('music track missing:', t.file);
        // If the failed track was playing, move on
        if (this.current === key) this.next();
      });
      a.addEventListener('ended', () => {
        if (this.current === key) this.next();
      });
      a.src = t.file;
      // Loop only if this is the sole track available, otherwise
      // let it end so the playlist can advance
      a.loop = false;
      a.preload = 'auto';
      a.volume = 0;
      this.loaded[key] = a;
      return a;
    } catch (e) {
      this.failed[key] = true;
      return null;
    }
  },

  // Called whenever the screen changes
  setScreen(screen) {
    const wasTac = this.inTactical;
    this.inTactical = (screen === 'tactical');
    if (this.inTactical && !wasTac) {
      this.intensity = 'sailing';
      this._intensityHold = 0;
    }
    const list = SCREEN_MUSIC[screen] || null;
    this.setPlaylist(list);
  },

  // Walk the fallback chain until a state has playable tracks
  resolveState(name) {
    let n = name, guard = 0;
    while (n && guard++ < 6) {
      const list = PLAYLISTS[n] || [];
      for (const k of list) this._load(k);
      if (list.some(k => TRACKS[k] && !this.failed[k])) return n;
      n = PLAYLIST_FALLBACK[n];
    }
    return null;
  },

  setPlaylist(name) {
    if (!this.ready) this.init();
    const resolved = this.resolveState(name);
    this.requested = name;
    if (!resolved) { this.play(null); return; }
    if (this.playlist === resolved && this.current) return;   // already on it

    this.playlist = resolved;
    const avail = PLAYLISTS[resolved].filter(k => TRACKS[k] && !this.failed[k]);
    if (!avail.length) { this.play(null); return; }

    this.order = this.shuffle ? this._shuffled(avail) : avail.slice();
    // If the track already playing is in this list, keep it rather
    // than restarting — avoids a jarring cut between related screens
    const keep = this.order.indexOf(this.current);
    if (keep >= 0) {
      this.orderIdx = keep;
      // Refresh looping: a one-track state must loop, a multi-track
      // one must end so it can advance.
      if (this.el) { try { this.el.loop = (this.order.length <= 1); } catch (e) {} }
      return;
    }

    this.orderIdx = 0;
    this.play(this.order[0]);
  },

  _shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // Advance to the next track in the current playlist
  next() {
    if (!this.order.length) return;
    this.orderIdx = (this.orderIdx + 1) % this.order.length;
    // Reshuffle when we wrap so repeats do not fall in the same order
    if (this.orderIdx === 0 && this.shuffle && this.order.length > 2) {
      this.order = this._shuffled(this.order);
    }
    this.play(this.order[this.orderIdx]);
  },

  play(key) {
    if (!this.ready) this.init();
    if (key === this.current) return;
    if (key && this.failed[key]) return;

    const next = key ? this._load(key) : null;

    // Same audio element already playing — just keep it
    if (next && this.el === next) { this.current = key; return; }

    if (this.el) {
      this.elB = this.el;      // fade this one out
    }
    this.el = next;
    this.current = key;
    this.fading = true;
    this.fadeT = 0;

    if (this.el) {
      // Single-track playlists loop; multi-track ones advance
      this.el.loop = (this.order.length <= 1);
      try {
        if (this.el.paused) {
          this.el.currentTime = 0;
          const p = this.el.play();
          if (p && p.catch) p.catch(() => { /* needs a gesture first */ });
        }
      } catch (e) {}
    }
  },

  stop() {
    if (this.el) { try { this.el.pause(); } catch (e) {} }
    if (this.elB) { try { this.elB.pause(); } catch (e) {} }
    this.el = null; this.elB = null; this.current = null;
  },

  // Combat ducking — call every frame with whether threats are live
  setCombat(active) {
    this.duckTarget = active ? 0.28 : 1;
  },

  // ── DYNAMIC INTENSITY ───────────────────────────────────────
  // Called every frame during a mission. Escalates sailing ->
  // tension -> action, and eases back down with hysteresis so
  // the music does not flap between states.
  updateIntensity(dt, sit) {
    if (!this.inTactical) return;

    let want = 'sailing';
    if (sit.firing || (sit.threats > 0 && sit.nearestTTI !== null && sit.nearestTTI < 45)) {
      want = 'action';
    } else if (sit.threats > 0 || sit.hostiles > 0) {
      want = 'tension';
    } else if (sit.unknowns > 0) {
      want = 'tension';
    }

    const rank = { sailing: 0, tension: 1, action: 2 };
    const cur = rank[this.intensity] || 0;
    const nxt = rank[want] || 0;

    if (nxt > cur) {
      // Escalate immediately
      this.intensity = want;
      this._intensityHold = 12;         // stay up at least 12s
      this.setPlaylist(want);
    } else if (nxt < cur) {
      // Wind down slowly
      this._intensityHold -= dt;
      if (this._intensityHold <= 0) {
        this.intensity = want;
        this._intensityHold = 0;
        this.setPlaylist(want);
      }
    } else {
      this._intensityHold = Math.max(this._intensityHold, 4);
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      if (this.el) { try { this.el.pause(); } catch (e) {} }
      if (this.elB) { try { this.elB.pause(); } catch (e) {} }
    } else if (this.el) {
      try { const p = this.el.play(); if (p && p.catch) p.catch(()=>{}); } catch (e) {}
    }
    return this.enabled;
  },

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); },

  // Resume after the first user gesture — browsers block autoplay
  resume() {
    if (!this.enabled || !this.el) return;
    try {
      if (this.el.paused) {
        const p = this.el.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {}
  },

  update(dt) {
    if (!this.ready) return;

    // Ease the duck
    const dspeed = this.duckTarget < this.duck ? 6 : 2.2;  // duck fast, recover slow
    this.duck += (this.duckTarget - this.duck) * Math.min(1, dt * dspeed);

    const trackGain = (this.current && TRACKS[this.current])
      ? (TRACKS[this.current].gain !== undefined ? TRACKS[this.current].gain : 1) : 1;
    const screenGain = this.inTactical ? this.tacticalGain : 1;
    const target = this.enabled ? this.volume * trackGain * screenGain * this.duck : 0;

    if (this.fading) {
      this.fadeT += dt;
      const k = Math.min(1, this.fadeT / this.fadeDur);
      if (this.el) this._setVol(this.el, target * k);
      if (this.elB) {
        this._setVol(this.elB, this._volOf(this.elB) * (1 - k) + 0);
        if (k >= 1) {
          try { this.elB.pause(); this.elB.currentTime = 0; } catch (e) {}
          this.elB = null;
        }
      }
      if (k >= 1) this.fading = false;
    } else if (this.el) {
      // Smoothly track the target so ducking is audible
      const cur = this._volOf(this.el);
      this._setVol(this.el, cur + (target - cur) * Math.min(1, dt * 5));
    }
  },

  _setVol(el, v) {
    try { el.volume = Math.max(0, Math.min(1, v)); } catch (e) {}
  },
  _volOf(el) {
    try { return el.volume; } catch (e) { return 0; }
  },

  // Attribution required by CC BY — surfaced in game, not just a text file
  attributions() {
    const seen = new Set();
    const out = [];
    for (const key of Object.keys(TRACKS)) {
      const t = TRACKS[key];
      if (this.failed[key]) continue;
      if (!t || !t.title) continue;
      const id = t.title + t.composer;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(t);
    }
    return out;
  },

  nowPlaying() {
    if (!this.enabled || !this.current) return null;
    return TRACKS[this.current] || null;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MusicSys, TRACKS, SCREEN_MUSIC, PLAYLISTS, PLAYLIST_FALLBACK };
}

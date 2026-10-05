// ═══════════════════════════════════════════════════════════════
//  APP — state machine, display handling, screen routing
// ═══════════════════════════════════════════════════════════════

const App = {
  screen: SCREEN.MENU,
  camp: null,
  globe: null,
  menuSel: 0,
  btns: [],
  transit: null,
  pendingMission: null,
  mouse: { x: 0, y: 0, down: false, dragging: false, dragX: 0, dragY: 0, camX: 0, camY: 0 },
  cfg: { fullscreen: false, autoSlow: true, uiScale: 1 },
  t: 0,
  lastReal: performance.now(),
  fps: 0, frameMs: 0, _fpsAcc: 0, _fpsCount: 0,
  tacticalActive: false,

  intro: null,
  scenario: null,
  shipLog: null,
  logScroll: 0,
  revealPhase: 0,

  init() {
    this.camp = new Campaign();
    this.shipLog = new ShipLog();
    this.globe = new GlobeView();
    // Frame the ship and its first tasking rather than dropping
    // the player on an empty ocean with everything off-screen
    const first = this.camp.availableMissions()[0];
    if (first) {
      this.globe.centreOn((this.camp.shipLon + first.lon) / 2,
                          (this.camp.shipLat + first.lat) / 2);
      this.globe.zoom = this.globe.targetZoom = 3.0;
      this.globe.selected = first;
    } else {
      this.globe.centreOn(this.camp.shipLon, this.camp.shipLat);
    }
    this.camp.addNews('DDG-144 declared operational',
      'Independent operations. Norfolk departure authorised.', 'good');
  },

  goto(s) {
    this.screen = s;
    this.btns = [];
    Audio.uiClick();
    MusicSys.setScreen(s);
  },

  startTransit(m) {
    const nm = this.camp.distanceTo(m.lon, m.lat);
    this.transit = {
      destName: m.name,
      destSub: m.subtitle,
      totalNm: nm,
      speed: 18,
      totalHours: nm / 18,
      elapsed: 0,
      mission: m,
      fromLon: this.camp.shipLon, fromLat: this.camp.shipLat
    };
    this.pendingMission = m;
    this.goto(SCREEN.TRANSIT);
  },

  setTransitSpeed(s) {
    if (!this.transit) return;
    const remainNm = this.transit.totalNm * (1 - this.transit.elapsed / this.transit.totalHours);
    const doneNm = this.transit.totalNm - remainNm;
    this.transit.speed = s;
    this.transit.totalHours = doneNm / s + remainNm / s;
    this.transit.elapsed = doneNm / s;
    Audio.uiClick();
  },

  finishTransit() {
    const tr = this.transit;
    if (!tr) return;
    const remaining = Math.max(0, tr.totalHours - tr.elapsed);
    this.camp.clock.advanceHours(remaining);
    this.camp.checkConsequences();
    this.camp.shipLon = tr.mission.lon;
    this.camp.shipLat = tr.mission.lat;
    this.globe.centreOn(tr.mission.lon, tr.mission.lat);
    this.transit = null;
    this.goto(SCREEN.BRIEFING);
  },

  update(realDt) {
    this.t += realDt;
    MusicSys.update(realDt);

    if (this.screen === SCREEN.INTRO && this.intro) {
      this.intro.update(realDt);
      if (this.intro.done) {
        this.camp.addNews('Contract signed — Spearpoint Global Solutions',
          'DDG-144 transferred to independent operation. Master: MITCHELL.', 'good');
        this.goto(SCREEN.GLOBE);
      }
      return;
    }

    const z0 = this.globe.zoom;
    this.globe.update(realDt);
    if (Math.abs(this.globe.zoom - z0) > 1e-6) this.globe._cacheKey = '';

    if (this.screen === SCREEN.TRANSIT && this.transit) {
      // 1 real second = 1 transit hour at base rate
      const rate = 2.2;
      this.transit.elapsed += realDt * rate;
      this.camp.clock.advanceMinutes(realDt * rate * 60);
      // Consequences of past decisions land while you are under way
      const fired = this.camp.checkConsequences();
      for (const f of fired) if (f.kind === 'bad') Audio.newContact();
      if (this.transit.elapsed >= this.transit.totalHours) {
        this.finishTransit();
      }
    }
  },

  render(ctx, W, H) {
    switch (this.screen) {
      case SCREEN.MENU:
        drawMenu(ctx, W, H, this.t, this.menuSel, this.btns);
        break;
      case SCREEN.GLOBE:
        drawGlobe(ctx, W, H, this.t, this.globe, this.camp, this.btns, this.mouse);
        break;
      case SCREEN.TRANSIT:
        drawTransit(ctx, W, H, this.t, this.transit, this.camp, this.btns);
        break;
      case SCREEN.BRIEFING:
        drawBriefing(ctx, W, H, this.t, this.pendingMission, this.camp, this.btns);
        break;
      case SCREEN.SETTINGS:
        drawSettings(ctx, W, H, this.t, this.cfg, this.btns);
        break;
      case SCREEN.INTRO:
        drawIntro(ctx, W, H, this.intro, this.btns);
        break;
      case SCREEN.CREDITS:
        drawCredits(ctx, W, H, this.t, this.btns);
        break;
      case SCREEN.SHIPLOG:
        drawShipLog(ctx, W, H, this.t, this.shipLog, this.logScroll, this.btns);
        break;
      case SCREEN.REVEAL:
        drawReveal(ctx, W, H, this.t, this.revealPhase, this.btns);
        break;
      case SCREEN.DEBRIEF:
        drawDebrief(ctx, W, H, this.t, this.lastResult, this.btns);
        break;
      case SCREEN.TACTICAL:
        // handled by main.js
        break;
    }
    this.drawFps(ctx, W, H);
  },

  drawFps(ctx, W, H) {
    if (this.screen === SCREEN.TACTICAL) return;
    const U = uiScale(W, H);
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(90,130,165,0.28)';
    ctx.font = `${9*U}px monospace`;
    const ms = this.frameMs || 0;
    const col = this.fps < 30 ? 'rgba(255,120,90,0.75)' : 'rgba(90,130,165,0.28)';
    ctx.fillStyle = col;
    ctx.fillText(`${Math.round(this.fps)} fps  ${ms.toFixed(1)}ms  ·  ${W}x${H} @${(RENDER_DPR||1).toFixed(2)}x`,
                 W - 12*U, 14*U);
    ctx.restore();
  },

  // ── INPUT ────────────────────────────────────────────────────
  onClick(mx, my) {
    Audio.init(); Audio.resume();
    if (this.screen === SCREEN.REVEAL) {
      this.revealPhase++;
      if (this.revealPhase > 2) {
        this.shipLog.reveal();
        this.camp.sabotageKnown = true;
        this.logScroll = 0;
        this.logReturn = SCREEN.GLOBE; this.goto(SCREEN.SHIPLOG);
      }
      return true;
    }
    if (this.screen === SCREEN.SHIPLOG) { return true; }
    MusicSys.init(); MusicSys.resume();
    if (!MusicSys.current) MusicSys.setScreen(this.screen);
    if (this.screen === SCREEN.INTRO) {
      for (const b of this.btns) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.choice !== undefined) this.intro.choiceSel = b.choice;
        }
      }
      this.intro.advance(); Audio.uiClick();
      return true;
    }
    if (this.screen === SCREEN.DEBRIEF) { this.goto(SCREEN.GLOBE); return true; }
    for (const b of this.btns) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        this.handleBtn(b);
        return true;
      }
    }
    // Globe: clicking empty space clears selection
    if (this.screen === SCREEN.GLOBE) {
      this.globe.selected = null;
    }
    return false;
  },

  handleBtn(b) {
    Audio.uiClick();
    // Menu
    if (b.id) {
      switch (b.id) {
        case 'campaign':
          this.intro = new IntroSequence();
          this.goto(SCREEN.INTRO);
          break;
        case 'single':   this.goto(SCREEN.GLOBE); break;
        case 'deep':
          this.camp.addNews('DEEP WATER not yet available', 'Endless mode is in development.', 'info');
          this.goto(SCREEN.GLOBE);
          break;
        case 'settings': this.goto(SCREEN.SETTINGS); break;
        case 'credits':  this.goto(SCREEN.CREDITS); break;
        case 'exit':
          if (window.close) window.close();
          break;
      }
      return;
    }
    // Globe mission markers
    if (b.mission) {
      this.globe.selected = b.mission;
      return;
    }
    // Actions
    if (b.action === 'accept') {
      const m = this.globe.selected;
      if (!m) return;
      const d = this.camp.distanceTo(m.lon, m.lat);
      if (d > 5) this.startTransit(m);
      else { this.pendingMission = m; this.goto(SCREEN.BRIEFING); }
      return;
    }
    if (b.action === 'refuse') {
      const m = this.globe.selected;
      if (!m) return;
      this.camp.refuseMission(m);
      this.camp.addNews(`Declined: ${m.name}`, 'Tasking released to other assets.', 'info');
      this.globe.selected = null;
      return;
    }
    if (b.action === 'skip') { this.finishTransit(); return; }
    if (b.speed) { this.setTransitSpeed(b.speed); return; }
    if (b.action === 'start') { this.launchTactical(); return; }
    // Settings
    if (b.setting) {
      switch (b.setting) {
        case 'fullscreen': toggleFullscreen(); break;
        case 'audio': Audio.toggle(); break;
        case 'volume': Audio.setVolume(Audio.volume >= 1 ? 0.2 : Audio.volume + 0.2); break;
        case 'music': MusicSys.toggle(); break;
        case 'musicvol': MusicSys.setVolume(MusicSys.volume >= 1 ? 0.15 : MusicSys.volume + 0.15); break;
        case 'credits': this.goto(SCREEN.CREDITS); break;
        case 'autoslow': this.cfg.autoSlow = !this.cfg.autoSlow; break;
        case 'uiscale':
          const next = getUiScaleOverride() >= 1.6 ? 0.8 : getUiScaleOverride() + 0.2;
          setUiScale(next); this.cfg.uiScale = next;
          break;
      }
      return;
    }
  },

  launchTactical() {
    this.scenario = makeScenario(this.pendingMission);
    this.screen = SCREEN.TACTICAL;
    this.tacticalActive = true;
    if (typeof initWorld === 'function') initWorld(this.scenario);
    Audio.uiClick();
    MusicSys.setScreen(SCREEN.TACTICAL);
  },

  triggerReveal() {
    this.revealPhase = 0;
    this.goto(SCREEN.REVEAL);
  },

  finishMission(result) {
    const m = this.pendingMission;
    this.lastResult = {
      mission: m,
      scenario: this.scenario,
      success: this.scenario.state === 'complete',
      detail: result || this.scenario.result || {}
    };
    if (this.lastResult.success) {
      this.camp.completeMission(m, m.payment || 0);
      // Mission duration advances the clock
      const mins = Math.max(20, (this.scenario.elapsed || 600) / 60);
      this.camp.clock.advanceMinutes(mins);
      this.camp.checkConsequences();
    }
    this.tacticalActive = false;
    this.goto(SCREEN.DEBRIEF);
  },

  exitTactical() {
    this.screen = SCREEN.GLOBE;
    this.tacticalActive = false;
    this.btns = [];
    MusicSys.setCombat(false);
    MusicSys.setScreen(SCREEN.GLOBE);
  },

  onKey(k, e) {
    Audio.init(); Audio.resume();
    MusicSys.init(); MusicSys.resume();
    if (!MusicSys.current) MusicSys.setScreen(this.screen);
    if (k === 'F11') { toggleFullscreen(); return true; }
    if (k === 'n' || k === 'N') { MusicSys.toggle(); return true; }
    if (k === ',') { MusicSys.setVolume(MusicSys.volume - 0.1); return true; }
    if (k === '.') { MusicSys.setVolume(MusicSys.volume + 0.1); return true; }
    // C is the ESSM hotkey in a mission, so only claim it on menus
    if ((k === 'c' || k === 'C') && this.screen !== SCREEN.TACTICAL) {
      if (this.screen === SCREEN.CREDITS) { this.goto(SCREEN.MENU); return true; }
      if (this.screen === SCREEN.MENU) { this.goto(SCREEN.CREDITS); return true; }
    }

    if (this.screen === SCREEN.INTRO) {
      if (k === 'Escape') { this.intro.done = true; this.goto(SCREEN.GLOBE); return true; }
      if (k === 'ArrowUp' || k === 'w') { this.intro.moveChoice(-1); Audio.uiClick(); return true; }
      if (k === 'ArrowDown' || k === 's') { this.intro.moveChoice(1); Audio.uiClick(); return true; }
      if (k === ' ' || k === 'Enter') { this.intro.advance(); Audio.uiClick(); return true; }
      return true;
    }
    if (this.screen === SCREEN.DEBRIEF) {
      if (k === ' ' || k === 'Enter' || k === 'Escape') { this.goto(SCREEN.GLOBE); return true; }
      return true;
    }

    if (this.screen === SCREEN.MENU) {
      if (k === 'ArrowDown' || k === 's') { this.menuSel = (this.menuSel+1) % MENU_ITEMS.length; Audio.uiClick(); return true; }
      if (k === 'ArrowUp'   || k === 'w') { this.menuSel = (this.menuSel-1+MENU_ITEMS.length) % MENU_ITEMS.length; Audio.uiClick(); return true; }
      if (k === 'Enter' || k === ' ') { this.handleBtn({ id: MENU_ITEMS[this.menuSel].id }); return true; }
      return true;
    }
    if (this.screen === SCREEN.GLOBE) {
      if (k === 'Escape') { this.goto(SCREEN.MENU); return true; }
      if (k === 'b' || k === 'B') {
        this.logReturn = SCREEN.GLOBE; this.logScroll = 0;
        this.goto(SCREEN.SHIPLOG); return true;
      }
      if (k === 'Enter' && this.globe.selected) { this.handleBtn({ action:'accept' }); return true; }
      return true;
    }
    if (this.screen === SCREEN.TRANSIT) {
      if (k === ' ' || k === 'Enter') { this.finishTransit(); return true; }
      if (k === 'Escape') { this.transit = null; this.goto(SCREEN.GLOBE); return true; }
      return true;
    }
    if (this.screen === SCREEN.BRIEFING) {
      if (k === 'Enter' || k === ' ') { this.launchTactical(); return true; }
      if (k === 'Escape') { this.goto(SCREEN.GLOBE); return true; }
      return true;
    }
    if (this.screen === SCREEN.SETTINGS) {
      if (k === 'Escape') { this.goto(SCREEN.MENU); return true; }
      return true;
    }
    if (this.screen === SCREEN.CREDITS) {
      if (k === 'Escape' || k === 'Enter' || k === ' ') { this.goto(SCREEN.MENU); return true; }
      return true;
    }
    if (this.screen === SCREEN.SHIPLOG) {
      if (k === 'Escape') { this.goto(this.logReturn || SCREEN.GLOBE); return true; }
      if (k === 'ArrowDown') { this.logScroll += 40; return true; }
      if (k === 'ArrowUp')   { this.logScroll = Math.max(0, this.logScroll - 40); return true; }
      return true;
    }
    if (this.screen === SCREEN.REVEAL) {
      if (k === ' ' || k === 'Enter') {
        this.revealPhase++;
        if (this.revealPhase > 2) {
          this.shipLog.reveal();
          this.camp.sabotageKnown = true;   // past denials now read as lies
          this.logScroll = 0;
          this.logReturn = SCREEN.GLOBE;
          this.goto(SCREEN.SHIPLOG);
        }
        return true;
      }
      return true;
    }
    if (this.screen === SCREEN.TACTICAL) {
      if (k === 'Escape' && !App._escHeld) {
        // Handled in main.js — but backstop to leave tactical
        return false;
      }
      return false;
    }
    return false;
  },

  onWheel(dy, mx, my) {
    if (this.screen === SCREEN.SHIPLOG) {
      this.logScroll = Math.max(0, this.logScroll + (dy > 0 ? 60 : -60));
      return true;
    }
    if (this.screen === SCREEN.GLOBE) {
      const f = dy < 0 ? 1.15 : 1/1.15;
      this.globe.targetZoom = Math.max(0.75, Math.min(9, this.globe.targetZoom * f));
      this.globe._cacheKey = '';
      return true;
    }
    return false;
  },

  onMouseDown(mx, my, btn) {
    if (this.screen === SCREEN.GLOBE && btn === 0) {
      this.mouse.down = true;
      this.mouse.dragX = mx; this.mouse.dragY = my;
      this.mouse.camX = this.globe.cx; this.mouse.camY = this.globe.cy;
    }
  },
  onMouseUp() { this.mouse.down = false; this.mouse.dragging = false; },

  onMouseMove(mx, my, W, H) {
    this.mouse.x = mx; this.mouse.y = my;
    if (this.screen === SCREEN.GLOBE && this.mouse.down) {
      const dx = mx - this.mouse.dragX, dy = my - this.mouse.dragY;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.mouse.dragging = true;
      if (this.mouse.dragging) {
        const SIDE = 340 * uiScale(W,H);
        const vw = W - SIDE;
        const s = (vw / 360) * this.globe.zoom;
        this.globe.cx = this.mouse.camX - dx / s;
        this.globe.cy = this.mouse.camY + dy / s;
        this.globe.cx = Math.max(-180, Math.min(180, this.globe.cx));
        this.globe.cy = Math.max(-75, Math.min(80, this.globe.cy));
        this.globe._cacheKey = '';
      }
    }
    // Hover detection for globe markers
    if (this.screen === SCREEN.GLOBE) {
      this.globe.hover = null;
      for (const b of this.btns) {
        if (b.mission && mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h) {
          this.globe.hover = b.mission; break;
        }
      }
    }
  }
};

// ── DISPLAY / FULLSCREEN ──────────────────────────────────────
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el);
    App.cfg.fullscreen = true;
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    App.cfg.fullscreen = false;
  }
}
document.addEventListener('fullscreenchange', () => {
  App.cfg.fullscreen = !!document.fullscreenElement;
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App };
}

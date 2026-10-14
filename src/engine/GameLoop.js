// ═══════════════════════════════════════════════════════════════
//  GAME LOOP — fixed-timestep simulation, free-running rendering
//
//  The simulation always advances in exact steps of `step` seconds,
//  no matter the frame rate, so ship handling is identical at 30,
//  60 or 144 fps and at any time compression. Rendering happens
//  once per display frame and gets `alpha` (0..1) to interpolate
//  between the last two simulation states.
// ═══════════════════════════════════════════════════════════════
export class GameLoop {
  constructor({ step = 1 / 60, maxStepsPerFrame = 240, update, render }) {
    this.step = step;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.update = update;
    this.render = render;
    this.timeScale = 1;      // 0 = paused, 1 = real time, 4/15/60 = compression
    this.simTime = 0;        // seconds of simulated time
    this.ticks = 0;          // simulation steps taken
    this.frames = 0;         // frames rendered
    this._acc = 0;
    this._last = 0;
    this._running = false;
    this._raf = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  _frame(now) {
    if (!this._running) return;
    // Clamp long gaps (tab switch, breakpoint) so we don't spiral
    const realDt = Math.min((now - this._last) / 1000, 0.25);
    this._last = now;
    this._acc += realDt * this.timeScale;

    let steps = 0;
    while (this._acc >= this.step && steps < this.maxStepsPerFrame) {
      this.update(this.step);
      this._acc -= this.step;
      this.simTime += this.step;
      this.ticks++;
      steps++;
    }
    // If we hit the cap (very high compression), drop the backlog
    if (steps >= this.maxStepsPerFrame) this._acc = 0;

    this.render(this._acc / this.step, realDt);
    this.frames++;
    this._raf = requestAnimationFrame(this._frame);
  }
}

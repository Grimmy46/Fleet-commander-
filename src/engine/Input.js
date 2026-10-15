// ═══════════════════════════════════════════════════════════════
//  INPUT — keyboard and mouse state, read once per frame.
//  Keys use physical codes (KeyW, ArrowLeft…) so controls sit in
//  the same place on any keyboard layout.
// ═══════════════════════════════════════════════════════════════
export class Input {
  constructor(el = window) {
    this.held = new Set();           // physical key codes currently down
    this.mouse = { x: 0, y: 0, inside: false };
    this.wheel = 0;                  // accumulated wheel steps since last frame
    this.drag = { middle: false, dx: 0, dy: 0 };
    this._pressed = [];              // key codes pressed since last frame

    const on = (t, f, o) => el.addEventListener(t, f, o);
    on('keydown', (e) => {
      if (!e.repeat) this._pressed.push(e.code);
      this.held.add(e.code);
    });
    on('keyup', (e) => this.held.delete(e.code));
    on('blur', () => { this.held.clear(); this.drag.middle = false; this.mouse.inside = false; });
    on('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag.middle) { this.drag.dx += e.movementX; this.drag.dy += e.movementY; }
    });
    on('mouseout', (e) => { if (!e.relatedTarget) this.mouse.inside = false; });
    on('mousedown', (e) => { if (e.button === 1) { this.drag.middle = true; e.preventDefault(); } });
    on('mouseup', (e) => { if (e.button === 1) this.drag.middle = false; });
    on('wheel', (e) => {
      // Normalise: one notch ≈ 1, trackpads give fractions
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      this.wheel += px / 100;
      e.preventDefault();
    }, { passive: false });
    on('contextmenu', (e) => e.preventDefault());
  }

  isDown(...codes) { return codes.some((c) => this.held.has(c)); }

  /** Everything that happened since the last frame; clears the accumulators. */
  consume() {
    const out = {
      pressed: this._pressed,
      wheel: this.wheel,
      dragDx: this.drag.dx,
      dragDy: this.drag.dy
    };
    this._pressed = [];
    this.wheel = 0;
    this.drag.dx = 0;
    this.drag.dy = 0;
    return out;
  }
}

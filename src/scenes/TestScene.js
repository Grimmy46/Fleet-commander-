// ═══════════════════════════════════════════════════════════════
//  TEST SCENE — one destroyer with the real 0.14 handling and the
//  RTS camera. Glue only: the World simulates, the WorldRenderer
//  draws, the RtsCamera frames it, this file wires up input.
//
//  Camera   WASD / arrows / screen edge   pan
//           mouse wheel                   zoom toward cursor
//           middle-drag or Q / E          rotate
//           Space                         jump to ship and follow
//           Home                          reset view
//  Ship     I / K                         ordered speed ±5 knots
//  (temp)   J / L                         ordered heading ∓15°
//           (right-click orders replace these in task #5)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { World } from '../sim/World.js';
import { M_PER_NM } from '../sim/units.js';
import { WorldRenderer } from '../render/WorldRenderer.js';
import { RtsCamera } from '../render/RtsCamera.js';
import { Input } from '../engine/Input.js';

const AREA_NM = 40;   // test area: 80 × 80 nm around the start point

export class TestScene {
  init(engine) {
    this.engine = engine;
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 5, 60000);

    this.world = new World();
    this.ownId = this.world.addShip({ type: 'ddg', name: 'DDG-144', faction: 'friendly', hdg: 60, speed: 12 });
    this.world.command({ id: this.ownId, order: 'speed', kts: 12 });

    this.view = new WorldRenderer(engine.renderer, this.camera);
    this.root = this.view.root;

    const m = AREA_NM * M_PER_NM;
    this.rts = new RtsCamera(this.camera, { minX: -m, maxX: m, minZ: -m, maxZ: m });
    this._alpha = 0;
    this._followOwn = () => this.view.positionOf(this.world, this.ownId, this._alpha);
    this.rts.focusOn(0, 0, this._followOwn);
    this.rts.snap();

    this.input = new Input(window);
  }

  _shipKeys(pressed) {
    const own = this.world.get(this.ownId);
    if (!own) return;
    const p = own.phys;
    for (const code of pressed) {
      if (code === 'KeyI') this.world.command({ id: own.id, order: 'speed', kts: p.ordSpeed + 5 });
      if (code === 'KeyK') this.world.command({ id: own.id, order: 'speed', kts: p.ordSpeed - 5 });
      if (code === 'KeyJ') this.world.command({ id: own.id, order: 'heading', deg: p.ordHdg - 15 });
      if (code === 'KeyL') this.world.command({ id: own.id, order: 'heading', deg: p.ordHdg + 15 });
    }
  }

  /** Fixed step. */
  update(dt) { this.world.step(dt); }

  /** Per frame. realDt drives the camera so it works while paused. */
  render(alpha, realDt) {
    this._alpha = alpha;
    const ev = this.input.consume();
    this._shipKeys(ev.pressed);
    if (ev.pressed.includes('Space')) {
      const p = this._followOwn();
      if (p) this.rts.focusOn(p.x, p.z, this._followOwn);
    }
    if (ev.pressed.includes('Home')) {
      this.rts.target.yaw = 0;
      this.rts.target.dist = this.rts.c.startDist;
    }
    this.rts.handleInput(this.input, ev, realDt, window.innerWidth, window.innerHeight);
    this.rts.update(realDt);

    const t = this.world.time + alpha * this.engine.loop.step;
    this.view.render(this.world, alpha, t, this.rts.state());
  }

  /** Short text for the debug overlay. */
  status() {
    const own = this.world.get(this.ownId);
    if (!own) return '';
    const p = own.phys, r = p.rudder, c = this.rts.state();
    const dist = c.dist >= 1852 ? `${(c.dist / M_PER_NM).toFixed(1)} nm` : `${c.dist.toFixed(0)} m`;
    return `HDG ${p.hdg.toFixed(0).padStart(3, '0')}° → ${p.ordHdg.toFixed(0).padStart(3, '0')}°  ·  ` +
           `SPD ${p.speed.toFixed(1)} → ${p.ordSpeed.toFixed(0)} kts  ·  ` +
           `RUDDER ${Math.abs(r).toFixed(0)}° ${r > 0.5 ? 'STBD' : r < -0.5 ? 'PORT' : ''}<br>` +
           `CAM ${dist} · facing ${c.yawDeg.toFixed(0).padStart(3, '0')}° · pitch ${c.pitchDeg.toFixed(0)}° · ` +
           `${c.following ? 'FOLLOWING SHIP' : 'FREE'}`;
  }

  dispose() { this.view.dispose(); }
}

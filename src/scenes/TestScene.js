// ═══════════════════════════════════════════════════════════════
//  TEST SCENE — one destroyer you can drive, with the real 0.14
//  ship handling. Glue only: the World simulates, the
//  WorldRenderer draws, this file connects them to input.
//
//  W / S   ordered speed ±5 knots
//  A / D   ordered heading ∓15°
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { World } from '../sim/World.js';
import { WorldRenderer } from '../render/WorldRenderer.js';

export class TestScene {
  init(engine) {
    this.engine = engine;
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 5, 60000);

    this.world = new World();
    this.ownId = this.world.addShip({ type: 'ddg', name: 'DDG-144', faction: 'friendly', hdg: 60, speed: 12 });
    this.world.command({ id: this.ownId, order: 'speed', kts: 12 });

    this.view = new WorldRenderer(engine.renderer, this.camera);
    this.view.followId = this.ownId;
    this.root = this.view.root;

    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey);
  }

  _key(e) {
    const own = this.world.get(this.ownId);
    if (!own) return;
    const p = own.phys, k = e.key.toLowerCase();
    if (k === 'w') this.world.command({ id: own.id, order: 'speed', kts: p.ordSpeed + 5 });
    if (k === 's') this.world.command({ id: own.id, order: 'speed', kts: p.ordSpeed - 5 });
    if (k === 'a') this.world.command({ id: own.id, order: 'heading', deg: p.ordHdg - 15 });
    if (k === 'd') this.world.command({ id: own.id, order: 'heading', deg: p.ordHdg + 15 });
  }

  /** Fixed step. */
  update(dt) { this.world.step(dt); }

  /** Per frame. */
  render(alpha) {
    const t = this.world.time + alpha * this.engine.loop.step;
    this.view.render(this.world, alpha, t);
  }

  /** Short text for the debug overlay. */
  status() {
    const own = this.world.get(this.ownId);
    if (!own) return '';
    const p = own.phys;
    const r = p.rudder;
    return `HDG ${p.hdg.toFixed(0).padStart(3, '0')}° → ${p.ordHdg.toFixed(0).padStart(3, '0')}°  ·  ` +
           `SPD ${p.speed.toFixed(1)} → ${p.ordSpeed.toFixed(0)} kts  ·  ` +
           `RUDDER ${Math.abs(r).toFixed(0)}° ${r > 0.5 ? 'STBD' : r < -0.5 ? 'PORT' : ''}`;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this.view.dispose();
  }
}

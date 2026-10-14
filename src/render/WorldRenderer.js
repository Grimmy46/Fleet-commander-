// ═══════════════════════════════════════════════════════════════
//  WORLD RENDERER — draws a sim World. Reads world state, never
//  writes it. One view per entity, created and removed to match
//  the world, posed by interpolating between the entity's pose
//  before and after the last simulation step.
//
//  Sim → Three.js:  X = x nm × 1852 (east)
//                   Z = y nm × 1852 (south; north is -Z)
//                   rotation.y = -heading
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { M_PER_NM, DEG, angleDiff, wrap360 } from '../sim/units.js';
import { Environment } from './Environment.js';
import { buildPlaceholderDestroyer } from './models/placeholderDestroyer.js';

/** Interpolated pose of an entity, in sim units. */
export function lerpPose(e, alpha) {
  const p = e.prev, c = e.phys;
  return {
    x: p.x + (c.x - p.x) * alpha,
    y: p.y + (c.y - p.y) * alpha,
    hdg: wrap360(p.hdg + angleDiff(p.hdg, c.hdg) * alpha)
  };
}

export class WorldRenderer {
  constructor(renderer, camera) {
    this.camera = camera;
    this.root = new THREE.Scene();
    this.env = new Environment(renderer, this.root);
    this.views = new Map();        // entity id → Object3D
    this.followId = null;
    this.camDist = 520;
    this.camPitch = 52 * DEG;
    this.camYawOffset = 155 * DEG; // behind and to port of the bow
  }

  _sync(world) {
    const alive = new Set();
    for (const e of world.entities) {
      alive.add(e.id);
      if (!this.views.has(e.id)) {
        const view = e.kind === 'ship' ? buildPlaceholderDestroyer() : new THREE.Object3D();
        this.views.set(e.id, view);
        this.root.add(view);
      }
    }
    for (const [id, view] of this.views) {
      if (!alive.has(id)) { this.root.remove(view); this.views.delete(id); }
    }
  }

  render(world, alpha, t) {
    this._sync(world);
    let focus = null;
    for (const e of world.entities) {
      const pose = lerpPose(e, alpha);
      const view = this.views.get(e.id);
      const X = pose.x * M_PER_NM, Z = pose.y * M_PER_NM;
      // Cosmetic motion only: bob, roll and pitch don't exist in the sim
      const ph = e.id * 1.7;
      view.position.set(X, Math.sin(t * 0.7 + ph) * 0.25, Z);
      view.rotation.set(Math.sin(t * 0.45 + ph) * 0.008, -pose.hdg * DEG, Math.sin(t * 0.6 + ph) * 0.018, 'YXZ');
      if (e.id === this.followId) focus = { X, Z, hdg: pose.hdg };
    }

    // Angled RTS-style camera trailing the followed ship (#3 adds controls)
    if (focus) {
      const yaw = focus.hdg * DEG + this.camYawOffset;
      const flat = Math.cos(this.camPitch) * this.camDist;
      this.camera.position.set(
        focus.X + Math.sin(yaw) * flat,
        Math.sin(this.camPitch) * this.camDist,
        focus.Z - Math.cos(yaw) * flat);
      this.camera.lookAt(focus.X, 0, focus.Z);
      this.env.update(focus.X, focus.Z, t);
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    this.env.dispose();
  }
}

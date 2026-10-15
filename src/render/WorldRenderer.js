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

const FACTION_COLORS = { friendly: '#4da6ff', hostile: '#ff4d4d', neutral: '#4ef09a' };
const markerTextures = {};

// Screen-space marker so ships stay visible when zoomed far out.
// Placeholder for the NATO symbols that come with the minimap (#6).
function markerTexture(faction) {
  if (markerTextures[faction]) return markerTextures[faction];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = g.fillStyle = FACTION_COLORS[faction] || FACTION_COLORS.neutral;
  g.lineWidth = 5;
  g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(32, 32, 6, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (markerTextures[faction] = tex);
}

/** Marker opacity: hidden up close, fully shown once the model is tiny. */
export function markerOpacity(camDist) {
  return THREE.MathUtils.smoothstep(camDist, 2500, 7000);
}

export class WorldRenderer {
  constructor(renderer, camera) {
    this.camera = camera;
    this.root = new THREE.Scene();
    this.env = new Environment(renderer, this.root);
    this.views = new Map();        // entity id → { model, marker }
  }

  _sync(world) {
    const alive = new Set();
    for (const e of world.entities) {
      alive.add(e.id);
      if (!this.views.has(e.id)) {
        const model = e.kind === 'ship' ? buildPlaceholderDestroyer() : new THREE.Object3D();
        const marker = new THREE.Sprite(new THREE.SpriteMaterial({
          map: markerTexture(e.faction), sizeAttenuation: false,
          depthTest: false, transparent: true, opacity: 0
        }));
        marker.scale.set(0.035, 0.035, 1);
        marker.renderOrder = 10;
        this.views.set(e.id, { model, marker });
        this.root.add(model, marker);
      }
    }
    for (const [id, v] of this.views) {
      if (!alive.has(id)) { this.root.remove(v.model, v.marker); this.views.delete(id); }
    }
  }

  /** Interpolated position of an entity in metres, or null. */
  positionOf(world, id, alpha) {
    const e = world.get(id);
    if (!e) return null;
    const p = lerpPose(e, alpha);
    return { x: p.x * M_PER_NM, z: p.y * M_PER_NM };
  }

  /**
   * Draw the world. `cam` is the RtsCamera state: its focus centres
   * the ocean and shadows, its distance drives fog and markers.
   */
  render(world, alpha, t, cam) {
    this._sync(world);
    const mo = markerOpacity(cam.dist);
    for (const e of world.entities) {
      const pose = lerpPose(e, alpha);
      const { model, marker } = this.views.get(e.id);
      const X = pose.x * M_PER_NM, Z = pose.y * M_PER_NM;
      // Cosmetic motion only: bob, roll and pitch don't exist in the sim
      const ph = e.id * 1.7;
      model.position.set(X, Math.sin(t * 0.7 + ph) * 0.25, Z);
      model.rotation.set(Math.sin(t * 0.45 + ph) * 0.008, -pose.hdg * DEG, Math.sin(t * 0.6 + ph) * 0.018, 'YXZ');
      marker.position.set(X, 20, Z);
      marker.material.opacity = mo;
      marker.visible = mo > 0.01;
    }
    this.env.update(cam.x, cam.z, t, this.camera, cam.dist);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    this.env.dispose();
  }
}

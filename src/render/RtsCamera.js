// ═══════════════════════════════════════════════════════════════
//  RTS CAMERA — Command & Conquer: Generals – Zero Hour style.
//
//  The camera orbits a focus point on the sea surface:
//    focus (x, z)  where it looks, metres
//    dist          distance from focus, metres (zoom)
//    yaw           compass direction the camera faces, radians
//                  (0 = looking north)
//  Pitch follows zoom: low and cinematic up close, near top-down
//  when zoomed out, like a tactical map.
//
//  Every control moves a *target*; the visible camera eases toward
//  it with frame-rate-independent damping, so it feels the same at
//  30 and 144 fps. Camera time is real time: it keeps working
//  while the game is paused.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';

const DEG = Math.PI / 180;

export const CAMERA_DEFAULTS = {
  minDist: 120,           // metres: close enough to see the deck
  maxDist: 90000,         // metres: whole mission area
  startDist: 900,
  zoomStep: 1.18,         // per wheel notch
  panSpeed: 1.1,          // screen-heights per second
  rotateSpeed: 90 * DEG,  // Q/E, radians per second
  dragRotate: 0.3 * DEG,  // middle-drag, radians per pixel
  edgePx: 14,             // edge-scroll margin
  damping: 12             // higher = snappier
};

/** Pitch (radians above horizontal) for a given distance. */
export function pitchForDist(dist, c = CAMERA_DEFAULTS) {
  // 0 at minDist → 1 at maxDist, on a log scale
  const t = THREE.MathUtils.clamp(Math.log(dist / c.minDist) / Math.log(c.maxDist / c.minDist), 0, 1);
  const s = t * t * (3 - 2 * t);
  return (32 + (82 - 32) * s) * DEG;
}

/** Fraction of the remaining distance covered in dt (exponential ease). */
export const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

export class RtsCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{minX,maxX,minZ,maxZ}} bounds  focus limits in metres
   */
  constructor(camera, bounds, opts = {}) {
    this.camera = camera;
    this.c = { ...CAMERA_DEFAULTS, ...opts };
    this.bounds = bounds;
    this.target = { x: 0, z: 0, dist: this.c.startDist, yaw: 0 };
    this.cur = { ...this.target };
    this.follow = null;       // () => {x, z} in metres, or null
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  // ── Controls ────────────────────────────────────────────────
  /** Pan by screen-relative amounts (right, forward) in screen-heights. */
  pan(right, forward) {
    if (right === 0 && forward === 0) return;
    this.follow = null;                      // any manual pan stops following
    const k = this.target.dist * this.c.panSpeed;
    const y = this.target.yaw;
    // Forward = the direction the camera faces on the ground
    this.target.x += (Math.sin(y) * forward + Math.cos(y) * right) * k;
    this.target.z += (-Math.cos(y) * forward + Math.sin(y) * right) * k;
    this._clamp();
  }

  rotate(rad) { this.target.yaw = this.target.yaw + rad; }

  /**
   * Zoom by wheel notches (+ = out). With a ground point under the
   * cursor, the zoom moves toward it so that point stays put.
   */
  zoom(notches, ground = null) {
    if (notches === 0) return;
    const before = this.target.dist;
    const after = THREE.MathUtils.clamp(before * Math.pow(this.c.zoomStep, notches), this.c.minDist, this.c.maxDist);
    this.target.dist = after;
    if (ground && !this.follow) {
      const f = 1 - after / before;          // + when zooming in
      this.target.x += (ground.x - this.target.x) * f;
      this.target.z += (ground.z - this.target.z) * f;
      this._clamp();
    }
  }

  /** Jump to a point and optionally keep following it. */
  focusOn(x, z, follow = null) {
    this.target.x = x; this.target.z = z;
    this.follow = follow;
    this._clamp();
  }

  /** Point on the sea surface under a screen position, or null (sky). */
  groundAt(sx, sy, width, height) {
    const ndc = new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1);
    this._ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._plane, p) ? p : null;
  }

  // ── Per frame ───────────────────────────────────────────────
  /**
   * Read input and move. `input` is an Input instance, `ev` the
   * result of input.consume() for this frame.
   */
  handleInput(input, ev, dt, width, height) {
    let right = 0, forward = 0;
    if (input.isDown('KeyA', 'ArrowLeft')) right -= 1;
    if (input.isDown('KeyD', 'ArrowRight')) right += 1;
    if (input.isDown('KeyW', 'ArrowUp')) forward += 1;
    if (input.isDown('KeyS', 'ArrowDown')) forward -= 1;
    if (input.mouse.inside && !input.drag.middle) {
      const m = input.mouse, e = this.c.edgePx;
      if (m.x <= e) right -= 1;
      if (m.x >= width - 1 - e) right += 1;
      if (m.y <= e) forward += 1;
      if (m.y >= height - 1 - e) forward -= 1;
    }
    this.pan(right * dt, forward * dt);

    if (input.isDown('KeyQ')) this.rotate(-this.c.rotateSpeed * dt);
    if (input.isDown('KeyE')) this.rotate(this.c.rotateSpeed * dt);
    if (ev.dragDx) this.rotate(ev.dragDx * this.c.dragRotate);

    if (ev.wheel) {
      const g = input.mouse.inside ? this.groundAt(input.mouse.x, input.mouse.y, width, height) : null;
      this.zoom(ev.wheel, g);
    }
  }

  update(dt) {
    if (this.follow) {
      const p = this.follow();
      if (p) { this.target.x = p.x; this.target.z = p.z; this._clamp(); }
    }
    const k = ease(this.c.damping, dt);
    const t = this.target, c = this.cur;
    c.x += (t.x - c.x) * k;
    c.z += (t.z - c.z) * k;
    // Zoom eases in log space so it feels even at every scale
    c.dist = Math.exp(Math.log(c.dist) + (Math.log(t.dist) - Math.log(c.dist)) * k);
    c.yaw += (t.yaw - c.yaw) * k;
    this._apply();
  }

  /** Snap the visible camera to the target (no easing). */
  snap() { Object.assign(this.cur, this.target); this._apply(); }

  _clamp() {
    const b = this.bounds, t = this.target;
    t.x = THREE.MathUtils.clamp(t.x, b.minX, b.maxX);
    t.z = THREE.MathUtils.clamp(t.z, b.minZ, b.maxZ);
  }

  _apply() {
    const c = this.cur, cam = this.camera;
    const pitch = pitchForDist(c.dist, this.c);
    const flat = Math.cos(pitch) * c.dist;
    // Camera sits behind the focus, opposite the direction it faces
    cam.position.set(c.x - Math.sin(c.yaw) * flat, Math.sin(pitch) * c.dist, c.z + Math.cos(c.yaw) * flat);
    cam.up.set(0, 1, 0);
    cam.lookAt(c.x, 0, c.z);
    // Keep depth precision sensible across a 750x zoom range
    cam.near = Math.max(1, c.dist * 0.01);
    cam.far = Math.max(60000, c.dist * 8);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();   // so groundAt() is right before the next render
  }

  /** State for the overlay and tests. */
  state() {
    return {
      x: this.cur.x, z: this.cur.z, dist: this.cur.dist,
      yawDeg: ((this.cur.yaw / DEG) % 360 + 360) % 360,
      pitchDeg: pitchForDist(this.cur.dist, this.c) / DEG,
      following: !!this.follow
    };
  }
}

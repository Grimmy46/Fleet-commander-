// ═══════════════════════════════════════════════════════════════
//  CAMERA TEST — RTS camera behaviour without a screen.
//  Run: node tests/camera.test.mjs
// ═══════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RtsCamera, pitchForDist, CAMERA_DEFAULTS as C } from '../src/render/RtsCamera.js';
import { markerOpacity } from '../src/render/WorldRenderer.js';

const W = 1600, H = 900, DEG = Math.PI / 180;
const B = { minX: -50000, maxX: 50000, minZ: -50000, maxZ: 50000 };
const make = () => {
  const cam = new THREE.PerspectiveCamera(40, W / H, 5, 60000);
  const r = new RtsCamera(cam, B);
  r.snap();
  return r;
};
const settle = (r, s = 3, fps = 60) => { for (let i = 0; i < s * fps; i++) r.update(1 / fps); };
const fakeInput = (keys = [], mouse = { x: W / 2, y: H / 2, inside: true }) =>
  ({ isDown: (...c) => c.some((k) => keys.includes(k)), mouse, drag: { middle: false } });
const noEv = { pressed: [], wheel: 0, dragDx: 0, dragDy: 0 };

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

console.log('Zoom');
test('zoom is limited to 120 m … 90 km', () => {
  const r = make();
  r.zoom(-100); assert.equal(r.target.dist, C.minDist);
  r.zoom(+200); assert.equal(r.target.dist, C.maxDist);
});
test('one wheel notch zooms by 18%', () => {
  const r = make(); const d = r.target.dist;
  r.zoom(1); assert.ok(Math.abs(r.target.dist - d * 1.18) < 1e-6);
});
test('zooming in moves toward the point under the cursor', () => {
  const r = make();
  const g = r.groundAt(W * 0.85, H * 0.3, W, H);
  const before = Math.hypot(g.x - r.target.x, g.z - r.target.z);
  r.zoom(-3, g); r.snap();
  const after = Math.hypot(g.x - r.target.x, g.z - r.target.z);
  assert.ok(after < before * 0.75, `focus did not move toward cursor (${before.toFixed(0)} → ${after.toFixed(0)} m)`);
  // and the cursor's ground point stays roughly under the cursor
  const g2 = r.groundAt(W * 0.85, H * 0.3, W, H);
  assert.ok(g2.distanceTo(g) < r.target.dist * 0.25, `cursor point drifted ${g2.distanceTo(g).toFixed(0)} m`);
});
test('pitch rises smoothly from 32° close up to 82° fully zoomed out', () => {
  assert.ok(Math.abs(pitchForDist(C.minDist) / DEG - 32) < 1e-9);
  assert.ok(Math.abs(pitchForDist(C.maxDist) / DEG - 82) < 1e-9);
  let last = 0;
  for (let d = C.minDist; d <= C.maxDist; d *= 1.1) { const p = pitchForDist(d); assert.ok(p >= last); last = p; }
});

console.log('Pan and rotate');
test('W pans north when facing north, east when facing east', () => {
  const r = make();
  r.pan(0, 1); assert.ok(r.target.z < 0 && Math.abs(r.target.x) < 1e-6);
  const s = make(); s.target.yaw = 90 * DEG;
  s.pan(0, 1); assert.ok(s.target.x > 0 && Math.abs(s.target.z) < 1e-6);
});
test('pan speed scales with zoom (same screen speed at any zoom)', () => {
  const a = make(); a.pan(1, 0);
  const b = make(); b.target.dist *= 10; b.pan(1, 0);
  assert.ok(Math.abs(b.target.x - a.target.x * 10) < 1e-6);
});
test('the focus cannot leave the map bounds', () => {
  const r = make();
  for (let i = 0; i < 1000; i++) r.pan(5, 5);
  assert.ok(r.target.x <= B.maxX && r.target.z >= B.minZ);
  assert.equal(r.target.x, B.maxX);
});
test('screen-edge scrolling pans; centre of screen does not', () => {
  const r = make();
  r.handleInput(fakeInput([], { x: W - 2, y: H / 2, inside: true }), noEv, 0.1, W, H);
  assert.ok(r.target.x > 0);
  const s = make();
  s.handleInput(fakeInput(), noEv, 0.1, W, H);
  assert.equal(s.target.x, 0); assert.equal(s.target.z, 0);
});
test('no edge scrolling when the mouse is outside the window', () => {
  const r = make();
  r.handleInput(fakeInput([], { x: 0, y: 0, inside: false }), noEv, 0.1, W, H);
  assert.equal(r.target.x, 0);
});
test('Q / E and middle-drag rotate', () => {
  const r = make();
  r.handleInput(fakeInput(['KeyE']), noEv, 0.5, W, H);
  assert.ok(Math.abs(r.target.yaw - 45 * DEG) < 1e-9);
  r.handleInput(fakeInput(), { ...noEv, dragDx: -150 }, 0.016, W, H);
  assert.ok(Math.abs(r.target.yaw) < 1e-9);
});

console.log('Follow and smoothing');
test('follows a moving target; any pan breaks the follow', () => {
  const r = make();
  let p = { x: 0, z: 0 };
  r.focusOn(0, 0, () => p);
  p = { x: 2000, z: -500 }; settle(r);
  assert.ok(Math.abs(r.cur.x - 2000) < 1 && Math.abs(r.cur.z + 500) < 1);
  r.pan(0.1, 0);
  assert.equal(r.follow, null);
});
test('easing is frame-rate independent (30 vs 144 fps)', () => {
  const a = make(), b = make();
  a.target.x = b.target.x = 5000; a.target.dist = b.target.dist = 20000;
  settle(a, 0.5, 30); settle(b, 0.5, 144);   // 15 and 72 whole frames
  assert.ok(Math.abs(a.cur.x - b.cur.x) < 5000 * 0.01, `x ${a.cur.x} vs ${b.cur.x}`);
  assert.ok(Math.abs(a.cur.dist - b.cur.dist) / b.cur.dist < 0.01);
});
test('camera is always above the water and looks at the focus', () => {
  const r = make();
  for (const d of [C.minDist, 1000, 10000, C.maxDist]) {
    r.target.dist = d; r.target.yaw = d; r.snap();
    assert.ok(r.camera.position.y > 0);
    const g = r.groundAt(W / 2, H / 2, W, H);
    assert.ok(Math.hypot(g.x - r.cur.x, g.z - r.cur.z) < d * 0.001 + 0.01, `centre of screen is off-focus at ${d} m`);
  }
});

console.log('Markers');
test('ship markers hidden up close, shown when zoomed out', () => {
  assert.equal(markerOpacity(1000), 0);
  assert.equal(markerOpacity(10000), 1);
});

console.log(`\nCAMERA TEST PASSED: ${passed} checks.`);

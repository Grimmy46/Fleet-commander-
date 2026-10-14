// RENDER HELPERS TEST — pure maths used by the renderer.
// Run: node tests/render.test.mjs
import assert from 'node:assert/strict';
import { lerpPose } from '../src/render/WorldRenderer.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const e = (prev, phys) => ({ prev, phys });

console.log('Interpolation');
test('halfway between two positions', () => {
  const p = lerpPose(e({ x: 0, y: 0, hdg: 10 }, { x: 2, y: -4, hdg: 30 }), 0.5);
  assert.deepEqual(p, { x: 1, y: -2, hdg: 20 });
});
test('heading wraps through north (359° → 1°), never spins the long way', () => {
  const p = lerpPose(e({ x: 0, y: 0, hdg: 359 }, { x: 0, y: 0, hdg: 1 }), 0.5);
  assert.ok(Math.abs(p.hdg - 0) < 1e-9 || Math.abs(p.hdg - 360) < 1e-9, `got ${p.hdg}`);
});
test('alpha 0 is the previous pose, alpha → 1 approaches the current pose', () => {
  const ent = e({ x: 1, y: 1, hdg: 90 }, { x: 3, y: 1, hdg: 100 });
  assert.deepEqual(lerpPose(ent, 0), { x: 1, y: 1, hdg: 90 });
  const p = lerpPose(ent, 0.999);
  assert.ok(Math.abs(p.x - 3) < 0.01 && Math.abs(p.hdg - 100) < 0.02);
});
console.log(`\nRENDER TEST PASSED: ${passed} checks.`);

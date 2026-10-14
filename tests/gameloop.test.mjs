// ═══════════════════════════════════════════════════════════════
//  GAME LOOP TEST — drives the fixed-step loop with a fake clock,
//  so timing checks are exact and don't depend on how fast the
//  test machine renders.   Run: node tests/gameloop.test.mjs
// ═══════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
const { GameLoop } = await import('../src/engine/GameLoop.js');

function run({ fps, seconds, timeScale = 1 }) {
  let updates = 0;
  const alphas = [];
  const loop = new GameLoop({ step: 1 / 60, update: () => updates++, render: (a) => alphas.push(a) });
  loop.timeScale = timeScale;
  loop.start();
  let now = loop._last;
  const frameMs = 1000 / fps;
  for (let i = 0; i < fps * seconds; i++) { now += frameMs; loop._frame(now); }
  return { loop, updates, alphas };
}

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ±${tol}`);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

console.log('GameLoop');
test('10 s at 60 fps simulates 10 s', () => {
  const { loop } = run({ fps: 60, seconds: 10 });
  near(loop.simTime, 10, 1 / 60 + 1e-9, 'simTime');
});
test('simulation is frame-rate independent (30 / 60 / 144 fps)', () => {
  for (const fps of [30, 60, 144]) near(run({ fps, seconds: 10 }).loop.simTime, 10, 1 / 60 + 1e-9, `${fps} fps`);
});
test('time compression: 4x, 15x, 60x', () => {
  for (const s of [4, 15, 60]) near(run({ fps: 60, seconds: 5, timeScale: s }).loop.simTime, 5 * s, 1 / 60 + 1e-9, `${s}x`);
});
test('pause (0x) stops the simulation but keeps rendering', () => {
  const { loop, alphas } = run({ fps: 60, seconds: 3, timeScale: 0 });
  assert.equal(loop.simTime, 0);
  assert.equal(alphas.length, 180);
});
test('interpolation alpha stays within [0, 1)', () => {
  const { alphas } = run({ fps: 144, seconds: 2 });
  assert.ok(alphas.every((a) => a >= 0 && a < 1));
});
test('a long stall (5 s) is clamped to 0.25 s, no catch-up spiral', () => {
  const loop = new GameLoop({ step: 1 / 60, update: () => {}, render: () => {} });
  loop.start();
  loop._frame(loop._last + 5000);
  near(loop.simTime, 0.25, 1 / 60 + 1e-9, 'simTime after stall');
});
test('step cap drops the backlog instead of freezing', () => {
  const loop = new GameLoop({ step: 1 / 60, maxStepsPerFrame: 10, update: () => {}, render: () => {} });
  loop.timeScale = 60;
  loop.start();
  loop._frame(loop._last + 250);   // would need 900 steps
  assert.equal(loop.ticks, 10);
});

console.log(`\nGAMELOOP TEST PASSED: ${passed} checks.`);

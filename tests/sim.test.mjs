// ═══════════════════════════════════════════════════════════════
//  SIMULATION TEST — runs the World with no graphics, far faster
//  than real time, and checks:
//    - it matches the 0.14 ship code exactly (side by side)
//    - the handling numbers players feel
//    - determinism and save/restore
//    - src/sim/ stays free of rendering and browser code
//  Run: node tests/sim.test.mjs
// ═══════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/sim/World.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DT = 1 / 60;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ±${tol}`);

// Load the original 0.14 Ship class from js/ship.js in a sandbox
function legacyShipClass() {
  const ctx = vm.createContext({ Math, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/ship.js'), 'utf8') + '\nglobalThis.__Ship = Ship;', ctx);
  return ctx.__Ship;
}

function newShip(init = {}) {
  const w = new World();
  const id = w.addShip({ type: 'ddg', ...init });
  return { w, id, s: () => w.get(id).phys };
}
const run = (w, seconds) => { for (let i = 0, n = Math.round(seconds / DT); i < n; i++) w.step(DT); };

console.log('Matches 0.14');
test('identical to 0.14 Ship.update over a 1-hour scripted voyage', () => {
  const Legacy = legacyShipClass();
  const old = new Legacy(0, 0, 30, 'friendly', 'ddg');
  const { w, id, s } = newShip({ hdg: 30 });
  // Speed changes, heading changes, astern, hard rudder: every branch
  const script = [
    [0, 'speed', 31], [0, 'heading', 120], [300, 'heading', 300], [700, 'speed', 8],
    [900, 'rudder', -35], [1200, 'rudder', 20], [1500, 'heading', 10], [1800, 'speed', -5],
    [2300, 'speed', 25], [2400, 'heading', 200], [3000, 'speed', 0]
  ];
  let next = 0, maxErr = 0;
  for (let i = 0; i < 3600 * 60; i++) {
    const t = i * DT;
    while (next < script.length && script[next][0] <= t + 1e-9) {
      const [, order, v] = script[next++];
      if (order === 'speed')   { old.orderSpeed(v);   w.command({ id, order, kts: v }); }
      if (order === 'heading') { old.orderHeading(v); w.command({ id, order, deg: v }); }
      if (order === 'rudder')  { old.orderRudder(v);  w.command({ id, order, deg: v }); }
    }
    old.update(DT);
    w.step(DT);
    const n = s();
    maxErr = Math.max(maxErr, Math.abs(old.x - n.x), Math.abs(old.y - n.y),
      Math.abs(old.speed - n.speed), Math.abs(old.rudder - n.rudder),
      Math.min(Math.abs(old.hdg - n.hdg), 360 - Math.abs(old.hdg - n.hdg)));
  }
  assert.ok(maxErr < 1e-9, `drifted from 0.14 by ${maxErr}`);
});

console.log('Handling (0.14 numbers)');
test('0 → 30 knots takes 107.1 s', () => {
  const { w, id, s } = newShip();
  w.command({ id, order: 'speed', kts: 31 });
  let t = 0;
  while (s().speed < 30) { w.step(DT); t += DT; }
  near(t, 30 / 0.28, 0.05, 'seconds');
});
test('flank speed is 31 knots and does not overshoot', () => {
  const { w, id, s } = newShip();
  w.command({ id, order: 'speed', kts: 99 });
  run(w, 300);
  assert.equal(s().speed, 31);
});
test('90° hard-rudder turn at 20 knots takes 65.2 s', () => {
  const { w, id, s } = newShip({ speed: 20 });
  w.command({ id, order: 'rudder', deg: 35 });
  let t = 0;
  while (s().hdg < 90) { w.step(DT); t += DT; }
  near(t, 65.15, 0.1, 'seconds');
});
test('90° autopilot course change at 20 knots settles in ~100 s, no overshoot', () => {
  const { w, id, s } = newShip({ speed: 20 });
  w.command({ id, order: 'heading', deg: 90 });
  let t = 0, maxHdg = 0;
  while (s().hdg < 89.5) { w.step(DT); t += DT; maxHdg = Math.max(maxHdg, s().hdg); }
  near(t, 99.7, 0.5, 'seconds');
  run(w, 300);
  assert.ok(Math.max(maxHdg, s().hdg) <= 90.0001, 'overshot ordered heading');
});
test('no steerage at zero speed', () => {
  const { w, id, s } = newShip({ hdg: 45 });
  w.command({ id, order: 'rudder', deg: 35 });
  run(w, 120);
  assert.equal(s().hdg, 45);
  assert.equal(s().rudder, 35);   // rudder still moves, ship doesn't turn
});
test('20 knots for one hour covers 20.00 nm', () => {
  const { w, s } = newShip({ hdg: 77, speed: 20 });
  run(w, 3600);
  near(Math.hypot(s().x, s().y), 20, 1e-6, 'nm');
});
test('heading 090 moves east (+x), heading 180 moves south (+y)', () => {
  const a = newShip({ hdg: 90, speed: 20 }); run(a.w, 60);
  assert.ok(a.s().x > 0.33 && Math.abs(a.s().y) < 1e-9);
  const b = newShip({ hdg: 180, speed: 20 }); run(b.w, 60);
  assert.ok(b.s().y > 0.33 && Math.abs(b.s().x) < 1e-9);
});

console.log('Determinism and saves');
function scripted() {
  const w = new World();
  const a = w.addShip({ type: 'ddg', hdg: 10 });
  const b = w.addShip({ type: 'ddg', hdg: 200, x: 3, y: -2, speed: 15 });
  w.command({ id: a, order: 'speed', kts: 28 });
  w.command({ id: a, order: 'heading', deg: 250 });
  w.command({ id: b, order: 'rudder', deg: -20 });
  return w;
}
test('same commands give bit-identical results', () => {
  const w1 = scripted(), w2 = scripted();
  run(w1, 900); run(w2, 900);
  assert.deepEqual(w1.snapshot(), w2.snapshot());
});
test('save mid-voyage, restore, continue: identical to never saving', () => {
  const straight = scripted();
  run(straight, 1200);
  const saved = scripted();
  run(saved, 500);
  const json = JSON.stringify(saved.snapshot());        // as written to disk
  const loaded = World.restore(JSON.parse(json));
  run(loaded, 700);
  assert.deepEqual(loaded.snapshot(), straight.snapshot());
});
test('orders queued before a save survive the save', () => {
  const w = new World();
  const id = w.addShip({ type: 'ddg' });
  w.command({ id, order: 'speed', kts: 20 });
  const loaded = World.restore(w.snapshot());
  run(loaded, 10);
  assert.equal(loaded.get(id).phys.ordSpeed, 20);
});
test('rejects saves from an unknown version', () => {
  assert.throws(() => World.restore({ ...new World().snapshot(), version: 999 }));
});
test('rejects unknown ship types and orders', () => {
  const w = new World();
  assert.throws(() => w.addShip({ type: 'battlestar' }));
  assert.throws(() => w.command({ id: 1, order: 'warp' }));
});
test('runs 10 simulated hours in well under 10 seconds', () => {
  const w = scripted();
  const t0 = performance.now();
  run(w, 36000);
  const ms = performance.now() - t0;
  assert.ok(ms < 10000, `took ${ms.toFixed(0)} ms`);
  console.log(`        (${(36000 / (ms / 1000)).toFixed(0)}x real time)`);
});

console.log('Architecture');
test('src/sim/ has no rendering or browser dependencies', () => {
  const dir = path.join(ROOT, 'src/sim');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const bad of [/from\s+['"]three/, /\bwindow\./, /\bdocument\./, /requestAnimationFrame/, /\bMath\.random\(/, /performance\.now/, /\.\.\/render\//]) {
      assert.ok(!bad.test(code), `src/sim/${f} uses ${bad}`);
    }
  }
});

console.log(`\nSIM TEST PASSED: ${passed} checks.`);

// ═══════════════════════════════════════════════════════════════
//  NEW ENGINE BOOTSTRAP (0.20)
// ═══════════════════════════════════════════════════════════════
import { REVISION } from 'three';
import { Engine } from './engine/Engine.js';
import { TestScene } from './scenes/TestScene.js';

const canvas = document.getElementById('view');
const statsEl = document.getElementById('stats');

let engine;
try {
  engine = new Engine(canvas);
} catch (e) {
  // No WebGL: tell the player what to do instead of a black screen
  document.getElementById('hud').innerHTML =
    '<div id="fatal">3D graphics could not start.<br><br>' +
    'Update your graphics driver, then restart the game.<br>' +
    'The 0.14 game still works: run it with --legacy or "Play Legacy 0.14.bat".<br><br>' +
    '<small>' + e.message + '</small></div>';
  throw e;
}
engine.setScene(new TestScene());
engine.start();

// Debug overlay (F3 toggles), refreshed twice a second
let lastFrames = 0, lastTime = performance.now();
setInterval(() => {
  const s = engine.stats();
  const now = performance.now();
  const fps = ((s.frames - lastFrames) * 1000) / (now - lastTime);
  lastFrames = s.frames; lastTime = now;
  statsEl.innerHTML =
    `${fps.toFixed(0)} fps · ${s.webgl} · three r${REVISION}<br>` +
    `sim ${s.simTime.toFixed(1)} s · ${s.ticks} ticks @ 60 Hz · ${s.timeScale}x<br>` +
    `${s.drawCalls} draws · ${(s.triangles / 1000).toFixed(1)}k tris · dpr ${s.pixelRatio.toFixed(2)}`;
}, 500);

// Time controls carried over from 0.14: 1 pause · 2 1x · 3 4x · 4 15x · 5 60x
const SPEEDS = { '1': 0, '2': 1, '3': 4, '4': 15, '5': 60 };
window.addEventListener('keydown', (e) => {
  if (e.key in SPEEDS) engine.loop.timeScale = SPEEDS[e.key];
  if (e.key === 'F3') statsEl.classList.toggle('hidden');
});

// Hook for the automated engine test (tests/engine-smoke-test.js)
window.__engine = {
  ready: true,
  stats: () => engine.stats(),
  setTimeScale: (v) => { engine.loop.timeScale = v; }
};

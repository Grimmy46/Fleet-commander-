// ═══════════════════════════════════════════════════════════════
//  ENGINE SMOKE TEST (0.20) — builds nothing; expects `npm run
//  build:renderer` to have produced out/renderer/. Serves it over
//  a local HTTP server, opens it in headless Chromium and fails if:
//    - any script error, console error or missing file appears
//    - WebGL does not start or nothing is drawn
//    - I / L keys do not reach the simulation
//    - wheel zoom, WASD pan or Space follow do not work
//    - the fixed-step simulation does not advance, or time
//      compression is not wired up (exact timing: gameloop.test.mjs)
//  Screenshot: tests/screenshots/engine-01-test-scene.png
// ═══════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const DIST = path.resolve(__dirname, '..', 'out', 'renderer');
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(DIST, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('out/renderer/index.html not found. Run `npm run build:renderer` first.');
    process.exit(1);
  }
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/`;

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push('Script error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('Console error: ' + m.text()); });
  page.on('requestfailed', (r) => problems.push('Missing file: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

  const check = (cond, msg) => { if (!cond) problems.push(msg); };

  console.log('Loading new engine from ' + url);
  await page.goto(url);
  await page.waitForFunction(() => window.__engine && window.__engine.stats().frames > 30, null, { timeout: 30000 })
    .catch(() => problems.push('Engine did not render 30 frames within 30 s'));

  const a = await page.evaluate(() => window.__engine && window.__engine.stats());
  if (a) {
    console.log(`Renderer: ${a.webgl}, ${a.drawCalls} draw calls, ${a.triangles} triangles`);
    check(a.drawCalls > 0, 'Nothing was drawn (0 draw calls)');
    check(a.ticks > 0, 'Simulation did not tick');

    // Rough check that time compression is wired up. Exact timing is
    // covered by tests/gameloop.test.mjs with a fake clock; here the
    // browser may render at ~1 fps in software, so only sanity-check.
    const simOver = async (scale) => {
      await page.evaluate((v) => window.__engine.setTimeScale(v), scale);
      const t0 = await page.evaluate(() => window.__engine.stats().simTime);
      await page.waitForTimeout(2000);
      return (await page.evaluate(() => window.__engine.stats().simTime)) - t0;
    };
    const at1 = await simOver(1);
    const at15 = await simOver(15);
    const ratio = at15 / Math.max(at1, 1e-6);
    console.log(`Time compression: ${at1.toFixed(2)} s at 1x vs ${at15.toFixed(2)} s at 15x (ratio ${ratio.toFixed(1)})`);
    check(at1 > 0, 'Simulation does not advance at 1x');
    check(ratio > 3, `Time compression not working (15x ran only ${ratio.toFixed(1)}x faster than 1x)`);
    await page.evaluate(() => window.__engine.setTimeScale(1));

    // Ship controls reach the simulation: I orders more speed, L turns
    const before = await page.evaluate(() => window.__engine.world().entities[0].phys);
    await page.keyboard.press('i');
    await page.keyboard.press('l');
    await page.evaluate(() => window.__engine.setTimeScale(15));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__engine.setTimeScale(1));
    const after = await page.evaluate(() => window.__engine.world().entities[0].phys);
    console.log(`Controls: ordered speed ${before.ordSpeed} → ${after.ordSpeed} kts, ` +
      `ordered heading ${before.ordHdg}° → ${after.ordHdg}°`);
    check(after.ordSpeed === before.ordSpeed + 5, 'I did not raise ordered speed by 5 knots');
    check(Math.abs(after.ordHdg - ((before.ordHdg + 15) % 360)) < 1e-9, 'L did not turn ordered heading by 15°');
    check(Math.hypot(after.x - before.x, after.y - before.y) > 0, 'Ship did not move');

    // Camera: zoom in close, then all the way out, then pan and re-follow
    const cam = () => page.evaluate(() => window.__engine.camera());
    const c0 = await cam();
    check(c0.following, 'Camera should start following the ship');
    await page.mouse.move(800, 450);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -100);
    await page.waitForTimeout(2500);
    const cClose = await cam();
    await page.screenshot({ path: path.join(OUT, 'engine-02-zoom-close.png') });
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 100);
    await page.waitForTimeout(3000);
    const cFar = await cam();
    await page.screenshot({ path: path.join(OUT, 'engine-03-zoom-far.png') });
    console.log(`Camera zoom: start ${c0.dist.toFixed(0)} m, close ${cClose.dist.toFixed(0)} m, far ${cFar.dist.toFixed(0)} m`);
    check(cClose.dist < c0.dist * 0.5, 'Wheel up did not zoom in');
    check(cFar.dist > 50000, 'Wheel down did not zoom out to the tactical view');
    check(cFar.pitchDeg > 75, 'Camera should look nearly straight down when zoomed out');

    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -100);
    await page.waitForTimeout(2000);
    const cMid0 = await cam();
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(800);
    const cPan = await cam();
    console.log(`Camera pan: following ${cMid0.following} → ${cPan.following}, moved ${Math.hypot(cPan.x - cMid0.x, cPan.z - cMid0.z).toFixed(0)} m`);
    check(!cPan.following, 'Panning should stop following the ship');
    check(Math.hypot(cPan.x - cMid0.x, cPan.z - cMid0.z) > 50, 'D did not pan the camera');
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    check((await cam()).following, 'Space did not return the camera to the ship');
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'engine-01-test-scene.png') });
  await browser.close();
  server.close();

  if (problems.length) {
    console.error('\nENGINE SMOKE TEST FAILED (' + problems.length + ' problem(s)):');
    for (const p of [...new Set(problems)]) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('\nENGINE SMOKE TEST PASSED: 3D scene renders and the simulation runs.');
})().catch((e) => { console.error(e); process.exit(1); });

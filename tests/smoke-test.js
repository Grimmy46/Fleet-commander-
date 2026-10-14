// ═══════════════════════════════════════════════════════════════
//  SMOKE TEST — loads the game in headless Chromium, walks from
//  the main menu into a tactical mission, and fails if any script
//  error, console error or missing file shows up along the way.
//  Screenshots are saved to tests/screenshots/.
//
//  Run locally:  npm i --no-save playwright
//                npx playwright install chromium
//                npm test
// ═══════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const problems = [];
  page.on('pageerror', e => problems.push('Script error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('Console error: ' + m.text()); });
  page.on('requestfailed', r => problems.push('Missing file: ' + r.url()));

  const shot = async (name) => page.screenshot({ path: path.join(OUT, name + '.png') });
  const wait = (ms) => page.waitForTimeout(ms);

  console.log('Loading game.html');
  await page.goto('file://' + path.join(ROOT, 'game.html'));
  await wait(3000);
  await shot('01-main-menu');

  console.log('Opening campaign');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) {
    await wait(1500);
    await shot(`0${i + 2}-campaign-step`);
    await page.keyboard.press(i < 3 ? 'Enter' : 'Space');
  }

  console.log('Running tactical at 15x for 6 seconds');
  await page.keyboard.press('4');
  await wait(6000);
  await shot('08-tactical');

  await browser.close();

  if (problems.length) {
    console.error('\nSMOKE TEST FAILED (' + problems.length + ' problem(s)):');
    for (const p of [...new Set(problems)]) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('\nSMOKE TEST PASSED: no errors from menu through tactical.');
})().catch(e => { console.error(e); process.exit(1); });

import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: 5177, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5177');
  await page.locator('.battle-hint').waitFor({ state: 'visible', timeout: 30000 });
  const results = [];
  for (const [width, height] of [[1440,900],[436,800],[427,800],[390,844],[360,720],[800,500]]) {
    await page.setViewportSize({ width, height });
    const result = await page.evaluate(() => {
      const hint = document.querySelector('.battle-hint');
      const energy = document.querySelector('.robot-elements');
      const controls = document.querySelector('.bottom-controls');
      const hs = getComputedStyle(hint), es = getComputedStyle(energy);
      const h = hint.getBoundingClientRect(), e = energy.getBoundingClientRect();
      const buttons = [...controls.querySelectorAll(':scope > .robot-button')];
      const countBadges = [...controls.querySelectorAll('.robot-button-count')];
      const clearance = [...buttons, ...countBadges].map(node => node.getBoundingClientRect().top - h.bottom);
      return { bg: hs.backgroundColor, energyBg: es.backgroundColor, color: hs.color, padding: hs.paddingLeft, energyPadding: es.paddingLeft, verticalGap: e.top - h.bottom, clearance, sideGap: parseFloat(getComputedStyle(controls).gap), left: h.left, right: h.right };
    });
    assert.equal(result.bg, result.energyBg);
    assert.equal(result.color, 'rgb(255, 255, 255)');
    assert.equal(result.padding, result.energyPadding);
    assert.ok(result.clearance.every(gap => gap >= result.sideGap), JSON.stringify(result));
    assert.ok(result.left >= 15 && result.right <= width - 15);
    results.push({ width, height, ...result });
  }
  await page.setViewportSize({ width: 427, height: 800 });
  await page.screenshot({ path: '.tmp/battle-hint-style.png', clip: { x: 0, y: 560, width: 427, height: 240 } });
  console.log(JSON.stringify(results, null, 2));
} finally { await browser?.close(); await server.close(); }

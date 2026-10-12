import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: 5177, strictPort: true }, plugins: [{ name: 'hover-preview', enforce: 'pre', transform(code, id) {
  if (id.replaceAll('\\', '/').endsWith('/src/game/defense-scene.ts')) return code.replace('create(): void {', 'create(): void { globalThis.__hoverScene = this;');
} }] });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5177');
  await page.waitForFunction(() => globalThis.__hoverScene?.simulation.status === 'running');
  await page.getByRole('button', { name: /^로봇 출격/ }).click();
  const dialog = page.locator('#robot-hangar');
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  assert.equal(await page.locator('.robot-card .robot-recipe').count(), 0);
  assert.equal(await page.locator('.robot-recipe-tooltip:visible').count(), 0);
  const expected = ['전기3+냉기2', '냉기3+화염2', '화염3+전기2'];
  for (let i = 0; i < 3; i++) {
    const slot = page.locator('.robot-card-slot').nth(i);
    assert.equal(await slot.locator('button').isDisabled(), true);
    await slot.hover();
    assert.equal(await slot.locator('[role=tooltip]').isVisible(), true);
    assert.equal((await slot.locator('.robot-recipe').innerText()).replaceAll(/\s/g, ''), expected[i]);
    assert.equal(await page.locator('.robot-recipe-tooltip:visible').count(), 1);
  }
  await page.mouse.move(20, 200);
  assert.equal(await page.locator('.robot-recipe-tooltip:visible').count(), 0);
  await page.screenshot({ path: '.tmp/robot-hangar-compact.png' });
  await page.locator('.robot-card-slot').first().focus();
  assert.equal(await page.locator('#robot-recipe-electric').isVisible(), true);
  await dialog.focus();
  await page.evaluate(() => { const scene = globalThis.__hoverScene; scene.simulation.elementEnergy = { electric: 3, ice: 2, fire: 0 }; scene.publish(); });
  assert.equal(await page.locator('.robot-card.electric').isEnabled(), true);
  await page.locator('.robot-card.electric').hover();
  assert.equal(await page.locator('#robot-recipe-electric').isVisible(), true);
  assert.equal(await page.locator('.robot-card.electric .robot-card-count').innerText(), '1');
  await page.screenshot({ path: '.tmp/robot-recipe-hover.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 3; i++) {
    const slot = page.locator('.robot-card-slot').nth(i); await slot.hover();
    const rect = await slot.locator('[role=tooltip]').boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
  }
  await page.screenshot({ path: '.tmp/robot-recipe-hover-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Verified compact cards, hover on enabled/disabled cards, exact recipes, keyboard focus and mobile tooltip bounds.');
} finally { await browser?.close(); await server.close(); }

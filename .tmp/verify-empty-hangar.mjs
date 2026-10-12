import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({
  root: process.cwd(), server: { host: '127.0.0.1', port: 5195, strictPort: true },
  plugins: [{ name: 'empty-hangar-check', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/src/game/defense-scene.ts'))
      return code.replace('create(): void {', 'create(): void { globalThis.__hangarScene = this;');
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5195');
  await page.waitForFunction(() => globalThis.__hangarScene?.simulation.status === 'running');
  await page.evaluate(() => {
    const scene = globalThis.__hangarScene;
    scene.update = () => {};
    scene.simulation.elementEnergy = { fire: 0, ice: 0, electric: 0 };
    scene.publish();
  });
  const button = page.locator('.bottom-controls button[aria-controls="robot-hangar"]');
  const modal = page.locator('#robot-hangar');
  await page.waitForFunction(() => document.querySelector('.bottom-controls button[aria-controls="robot-hangar"]')?.classList.contains('empty'));
  assert.equal(await button.isEnabled(), true);
  assert.equal(await modal.count(), 0, 'zero count does not automatically open');
  await button.click();
  await modal.waitFor({ state: 'visible' });
  assert.equal(await modal.evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await modal.evaluate(el => getComputedStyle(el).filter), 'grayscale(1)');
  assert.equal(await button.evaluate(el => getComputedStyle(el).opacity), '0.4');
  assert.equal(await modal.locator('button.robot-status-unit:disabled').count(), 3);
  await page.waitForFunction(() => !document.querySelector('.battle-hint'));
  await modal.locator('.robot-info-button').first().click();
  assert.equal(await modal.locator('.robot-info-button').first().getAttribute('aria-expanded'), 'true');
  await modal.locator('.robot-info-button').first().click();
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  await button.focus();
  await page.keyboard.press('Enter');
  await modal.waitFor({ state: 'visible' });
  await page.screenshot({ path: '.tmp/empty-hangar-desktop.png' });
  await page.locator('.summon-backdrop').click({ position: { x: 100, y: 150 } });
  await modal.waitFor({ state: 'hidden' });
  // Keep the current automatic opening behavior when enough energy arrives.
  await page.evaluate(async () => {
    const { ROBOTS } = await import('/src/game/wave-one.ts');
    const scene = globalThis.__hangarScene;
    for (const part of ROBOTS.electric.recipe) scene.simulation.elementEnergy[part.kind] = part.amount;
    scene.publish();
  });
  await modal.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#robot-hangar').classList.contains('empty'));
  assert.equal(await modal.evaluate(el => getComputedStyle(el).opacity), '1');
  await modal.locator('.robot-status-unit.electric').click();
  await page.waitForFunction(() => document.querySelector('#robot-hangar')?.classList.contains('empty'));
  assert.equal(await page.evaluate(() => globalThis.__hangarScene.simulation.robotCount), 1);
  assert.equal(await modal.locator('button.robot-status-unit:disabled').count(), 3);
  // The final summon leaves the now-empty modal open, and it can reopen by touch.
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => globalThis.__hangarScene.scale.width < 500);
  const bounds = await button.boundingBox();
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await modal.waitFor({ state: 'visible' });
  await page.screenshot({ path: '.tmp/empty-hangar-mobile.png' });
  await page.touchscreen.tap(100, 150);
  await modal.waitFor({ state: 'hidden' });
  await page.evaluate(() => {
    const scene = globalThis.__hangarScene;
    scene.simulation.status = 'paused';
    scene.publish();
  });
  await page.waitForFunction(() => document.querySelector('.bottom-controls button[aria-controls="robot-hangar"]').disabled);
  assert.deepEqual(errors, []);
  console.log('Zero-count mouse/keyboard/touch opening, opaque grayscale modal, faded placement button, disabled summons, recipe viewing, Escape/outside closing and positive-count opening verified; no browser errors.');
} finally {
  if (browser) await browser.close();
  await server.close();
}

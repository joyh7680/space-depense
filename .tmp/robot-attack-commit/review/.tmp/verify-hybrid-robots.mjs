import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({
  root: process.cwd(), server: { host: '127.0.0.1', port: 5177, strictPort: true },
  plugins: [{ name: 'hybrid-test-access', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/src/game/defense-scene.ts'))
      return code.replace('create(): void {', 'create(): void { globalThis.__hybridScene = this;');
  } }],
});
let browser;
try {
  await server.listen(); browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [], removedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/green-light|cooling-energy|flame-energy|electric-energy/.test(request.url())) removedAssets.push(request.url()); });
  await page.goto('http://127.0.0.1:5177');
  await page.waitForFunction(() => globalThis.__hybridScene?.simulation.status === 'running');
  await page.evaluate(() => {
    const scene = globalThis.__hybridScene;
    scene.simulation.player = { x: 14, y: 8 }; scene.simulation.enemies = [];
    scene.simulation.elementEnergy = { electric: 6, ice: 4, fire: 3 };
    scene.publish();
  });
  const deploy = page.getByRole('button', { name: /^로봇 출격/ });
  await deploy.click();
  assert.deepEqual(await page.locator('.robot-card-name').allTextContents(), ['크라이오 볼트', '써멀 쇼크', '플라즈마']);
  assert.deepEqual(await page.locator('.robot-card-count').allTextContents(), ['2', '1', '1']);
  assert.match(await deploy.getAttribute('aria-label'), /출격 가능 2대/);
  assert.deepEqual(await page.locator('.robot-recipe').allTextContents(), ['3+2', '3+2', '3+2']);
  await page.screenshot({ path: '.tmp/hybrid-hangar-desktop.png' });
  await page.locator('.robot-card.fire').click();
  await page.locator('.coding-panel').waitFor();
  assert.equal(await page.locator('.robot-hangar').count(), 0);
  assert.match(await page.locator('.coding-robot h3').innerText(), /플라즈마 #1/);
  assert.deepEqual(await page.evaluate(() => globalThis.__hybridScene.simulation.elementEnergy), { electric: 4, ice: 4, fire: 0 });
  await page.getByRole('button', { name: '코딩 패널 닫기' }).click();
  await deploy.click();
  assert.equal(await page.locator('.robot-card.ice').isDisabled(), true);
  assert.equal(await page.locator('.robot-card.fire').isDisabled(), true);
  assert.equal(await page.locator('.robot-card.electric').isEnabled(), true);
  assert.equal(await page.locator('.robot-card.electric .robot-card-count').innerText(), '1');
  assert.equal(await page.locator('.robot-card.ice').evaluate(el => getComputedStyle(el).filter), 'grayscale(1)');
  await page.locator('.robot-card.electric').click();
  await page.locator('.coding-panel').waitFor();
  assert.match(await page.locator('.coding-robot h3').innerText(), /크라이오 볼트 #1/);
  const answer = await page.evaluate(async () => {
    const { getCodingMission, getCodingBlock } = await import('/src/game/coding-missions.ts');
    const scene = globalThis.__hybridScene;
    const robot = scene.simulation.robots.at(-1);
    return getCodingMission(robot.kind, robot.missionNumber, robot.missionVariant).slots.map(slot => getCodingBlock(slot.block).label);
  });
  for (const label of answer) {
    await page.locator('.palette-block').filter({ hasText: label }).click();
  }
  assert.equal(await page.locator('.coding-success').count(), 1);
  await page.getByRole('button', { name: '코딩 패널 닫기' }).click();
  await page.evaluate(() => {
    const scene = globalThis.__hybridScene;
    scene.simulation.elementEnergy = { electric: 3, ice: 3, fire: 2 }; scene.publish();
  });
  await deploy.click();
  await page.locator('.robot-card.ice').click();
  assert.match(await page.locator('.coding-robot h3').innerText(), /써멀 쇼크 #1/);
  await page.getByRole('button', { name: '코딩 패널 닫기' }).click();
  for (const [width, height, suffix] of [[390, 844, 'mobile'], [720, 480, 'landscape']]) {
    await page.setViewportSize({ width, height });
    await deploy.click();
    await page.locator('.robot-hangar').waitFor();
    await page.locator('.robot-hangar').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const bounds = await page.locator('.robot-card').evaluateAll(cards => cards.map(card => {
      const rect = card.getBoundingClientRect();
      const name = card.querySelector('.robot-card-name').getBoundingClientRect();
      const recipe = card.querySelector('.robot-recipe').getBoundingClientRect();
      return { fits: rect.left >= 0 && rect.right <= innerWidth && name.left >= rect.left && name.right <= rect.right && recipe.bottom <= rect.bottom, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    }));
    assert.ok(bounds.every(card => card.fits), JSON.stringify(bounds));
    await page.screenshot({ path: `.tmp/hybrid-hangar-${suffix}.png` });
    await page.locator('#robot-hangar').press('Escape');
  }
  const beamColors = await page.evaluate(() => {
    const scene = globalThis.__hybridScene;
    const original = scene.simulation.step;
    scene.combatEffects.removeAll(true);
    scene.simulation.step = () => ['electric', 'ice', 'fire'].map((kind, index) => ({ kind, from: { x: 3 + index, y: 5 }, to: { x: 3 + index, y: 4 } }));
    try { scene.update(performance.now(), 0); } finally { scene.simulation.step = original; }
    return scene.combatEffects.getAll().map(beam => beam.strokeColor);
  });
  assert.deepEqual(beamColors, [0x7eeaff, 0x7eeaff, 0xffad65, 0xffad65, 0xd78aff, 0xd78aff]);
  assert.deepEqual(errors, []); assert.deepEqual(removedAssets, []);
  console.log(JSON.stringify({ result: 'Desktop and mobile deployment, costs, shared counts, coding, grayscale and removed assets verified', errors, removedAssets }));
} finally { await browser?.close(); await server.close(); }

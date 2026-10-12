import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({
  root: process.cwd(),
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
  plugins: [{
    name: 'robot-mission-test-access', enforce: 'pre',
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/game/defense-scene.ts')) {
        assert.ok(code.includes('create(): void {'));
        return code.replace('create(): void {', 'create(): void { globalThis.__robotMissionTestScene = this;');
      }
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5176');
  const deploy = page.getByRole('button', { name: /^로봇 출격/ });
  await deploy.waitFor();
  await page.waitForFunction(() => globalThis.__robotMissionTestScene?.simulation.status === 'running');
  await page.evaluate(() => {
    const scene = globalThis.__robotMissionTestScene;
    scene.simulation.elementEnergy.fire = 10;
  });
  await page.getByRole('button', { name: /로봇 출격, 미배치 보관 로봇 2대/ }).waitFor();
  assert.equal(await page.locator('.coding-panel').count(), 0);
  await deploy.click();
  await page.locator('.robot-card.fire').click();
  await page.locator('.coding-panel').waitFor();
  assert.equal(await page.locator('.robot-hangar').count(), 0);
  assert.match(await page.locator('.coding-robot h3').innerText(), /#1/);
  const first = await page.locator('.coding-mission-summary').innerText();
  const firstOptions = await page.locator('.palette-block').allTextContents();
  assert.equal(await page.locator('.coding-slot').count(), 2);
  await page.getByRole('button', { name: '코딩 패널 닫기' }).click();
  await deploy.click();
  await page.locator('.robot-card.fire').click();
  await page.locator('.coding-panel').waitFor();
  assert.match(await page.locator('.coding-robot h3').innerText(), /#2/);
  const second = await page.locator('.coding-mission-summary').innerText();
  const secondOptions = await page.locator('.palette-block').allTextContents();
  assert.notEqual(first, second); assert.notDeepEqual(firstOptions, secondOptions);
  assert.equal(await page.locator('.coding-slot.empty').count(), 3);
  const robots = await page.evaluate(() => globalThis.__robotMissionTestScene.simulation.robots.map(({ id, missionVariant, deployed, autoAttackActive, x, y }) => ({ id, missionVariant, deployed, autoAttackActive, x, y })));
  assert.equal(robots.length, 2); assert.ok(robots.every(robot => robot.deployed && !robot.autoAttackActive));
  assert.notDeepEqual([robots[0].x, robots[0].y], [robots[1].x, robots[1].y]);
  await page.screenshot({ path: '.tmp/robot-mission-panel.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ first, firstOptions, second, secondOptions, robots, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}

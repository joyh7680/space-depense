import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({
  root: process.cwd(), server: { host: '127.0.0.1', port: 5193, strictPort: true },
  plugins: [{ name: 'plasma-radius-verification', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/src/game/defense-scene.ts'))
      return code.replace('create(): void {', 'create(): void { globalThis.__radiusScene = this;');
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5193');
  await page.waitForFunction(() => globalThis.__radiusScene?.simulation.status === 'running');
  const result = await page.evaluate(async () => {
    const scene = globalThis.__radiusScene;
    scene.scene.pause();
    scene.simulation.elementEnergy = { fire: 30, electric: 30, ice: 30 };
    scene.simulation.placeRobot(7, 5, 'fire');
    scene.simulation.placeRobot(3, 5, 'electric');
    scene.simulation.placeRobot(9, 5, 'ice');
    scene.simulation.enemies = [5, 5.5, 6, 11].map((x, index) => ({
      id: 100 + index, x, y: 4, health: 68, waypoint: 1, burnTime: 0, burnDamage: 0, slowTime: 0,
    }));
    const { getCodingMission } = await import('/src/game/coding-missions.ts');
    for (const robot of scene.simulation.robots) {
      for (const [index, slot] of getCodingMission(robot.kind, 1, robot.missionVariant).slots.entries())
        scene.simulation.updateCode(robot.id, index, slot.block);
    }
    const results = {};
    for (const kind of ['electric', 'ice', 'fire']) {
      scene.selectRobot(scene.simulation.robots.find(robot => robot.kind === kind).id);
      results[kind] = scene.ranges.commandBuffer.length;
    }
    return results;
  });
  assert.equal(result.electric, 0);
  assert.equal(result.ice, 0);
  assert.ok(result.fire > 0);
  await page.screenshot({ path: '.tmp/plasma-radius-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.tmp/plasma-radius-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Only selected plasma draws an attack circle; desktop/mobile screenshots captured; no browser errors.');
} finally {
  if (browser) await browser.close();
  await server.close();
}

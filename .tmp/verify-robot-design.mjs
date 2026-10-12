import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire('C:/Users/logibros/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const server = await createServer({
  root: process.cwd(), server: { host: '127.0.0.1', port: 5194, strictPort: true },
  plugins: [{ name: 'robot-design-verification', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/src/game/defense-scene.ts'))
      return code.replace('create(): void {', 'create(): void { globalThis.__robotScene = this;');
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5194');
  await page.waitForFunction(() => globalThis.__robotScene?.simulation.status === 'running');
  await page.evaluate(async () => {
    const scene = globalThis.__robotScene;
    // Freeze simulation updates while keeping rendering, timers and real input active.
    scene.update = () => {};
    scene.simulation.elementEnergy = { fire: 40, electric: 40, ice: 40 };
    for (const [x, kind] of [[3, 'electric'], [7, 'ice'], [10, 'fire']])
      scene.simulation.placeRobot(x, 5, kind);
    scene.simulation.elapsed += 1;
    scene.drawUnits();
    scene.simulation.elapsed += 1;
    scene.drawUnits();
    scene.publish();
  });
  // Wait for the native canvas renderer and Vue's state subscription.
  await page.waitForFunction(() => document.querySelectorAll('.robot-status-unit').length === 3);
  const positions = await page.evaluate(() => {
    const scene = globalThis.__robotScene;
    return scene.simulation.robots.map(robot => {
      const art = scene.robotArt.get(robot.id);
      const camera = scene.cameras.main;
      const canvas = scene.game.canvas.getBoundingClientRect();
      const toScreen = (x, y) => ({ x: canvas.left + (x - camera.worldView.x) * camera.zoom,
        y: canvas.top + (y - camera.worldView.y) * camera.zoom });
      const hit = toScreen(art.x, art.y - 70);
      const pointer = { x: hit.x - canvas.left, y: hit.y - canvas.top };
      const unit = scene.unitAt(pointer);
      return { id: robot.id, kind: robot.kind, width: art.width, height: art.height,
        texture: art.texture.key, hitId: unit?.robotId, hit,
        dragTarget: toScreen((robot.x + 1) * 100 + 50, robot.y * 100 + 50 - 46) };
    });
  });
  assert.equal(new Set(positions.map(p => p.texture)).size, 3);
  for (const sprite of positions) {
    assert.equal(sprite.width, 64);
    assert.equal(sprite.height, 80);
    assert.equal(sprite.hitId, sprite.id, `${sprite.kind} head hitbox`);
  }
  await page.waitForFunction(() => globalThis.__robotScene.combatEffects.list.length === 0);
  await page.screenshot({ path: '.tmp/robot-redesign-desktop.png' });
  // A click on the newly designed head must still open its own mission.
  await page.locator('.summon-backdrop').click({ position: { x: 100, y: 100 } });
  for (const sprite of positions) {
    await page.mouse.click(sprite.hit.x, sprite.hit.y);
    await page.waitForFunction(kind => document.querySelector('.coding-panel')?.classList.contains(kind), sprite.kind);
    const portrait = await page.locator('.coding-robot .robot-portrait').evaluate(el => getComputedStyle(el).backgroundImage);
    assert.match(portrait, /games\/space\/robots\//);
    await page.locator('.coding-close').click();
  }
  const sprite = positions[0];
  await page.mouse.move(sprite.hit.x, sprite.hit.y);
  await page.mouse.down();
  await page.mouse.move(sprite.dragTarget.x, sprite.dragTarget.y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.evaluate(id => globalThis.__robotScene.simulation.robots.find(r => r.id === id).x, sprite.id), 4);
  // Every kind still activates its existing attack after completing its mission.
  const attackCounts = await page.evaluate(async () => {
    const scene = globalThis.__robotScene;
    const { getCodingMission } = await import('/src/game/coding-missions.ts');
    scene.simulation.enemies = scene.simulation.robots.map((r, i) => ({
      id: 100 + i, x: r.x, y: 4, health: 100000, waypoint: 1, burnTime: 0, burnDamage: 0, slowTime: 0,
    }));
    for (const r of scene.simulation.robots)
      for (const [i, slot] of getCodingMission(r.kind, 1, r.missionVariant).slots.entries())
        scene.simulation.updateCode(r.id, i, slot.block);
    for (let i = 0; i < 25; i++) scene.simulation.step(0.1);
    scene.drawUnits(); scene.publish();
    return scene.simulation.robots.map(r => ({ kind: r.kind, attacks: r.attacks }));
  });
  for (const r of attackCounts) assert.ok(r.attacks > 0, `${r.kind} attacks`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => globalThis.__robotScene.scale.width < 500);
  await page.screenshot({ path: '.tmp/robot-redesign-mobile.png' });
  const preview = await browser.newPage({ viewport: { width: 660, height: 270 }, deviceScaleFactor: 1 });
  await preview.setContent(`<html lang="ko"><style>
    *{box-sizing:border-box}body{margin:0;background:#263c43;color:#e1f1e7;font:14px system-ui,sans-serif}
    main{display:flex;gap:16px;padding:24px}section{width:193px;text-align:center;border:1px solid #567079;background:#304b53;padding:14px 0}
    .large{width:96px;height:120px}.small{width:32px;height:40px;margin-left:12px}img{image-rendering:pixelated;vertical-align:bottom}
    h2{font-size:15px;margin:16px 0 4px}p{font-size:11px;margin:0;color:#b8cace}
    </style><main>${[['cryo-bolt', '크라이오 볼트', '하늘색 · 파란 주먹'], ['thermal-shock', '써멀 쇼크', '주황색 · 하늘색 냉각 팔'], ['plasma', '플라즈마', '보라색 · 분홍 코어']].map(([file,name,desc]) =>
      `<section><img class="large" src="http://127.0.0.1:5194/games/space/robots/${file}.svg"><img class="small" src="http://127.0.0.1:5194/games/space/robots/${file}.svg"><h2>${name}</h2><p>${desc}</p></section>`).join('')}</main></html>`);
  await preview.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth === 64));
  await preview.screenshot({ path: '.tmp/robot-redesign-preview.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ positions, attackCounts }, null, 2));
  console.log('Desktop/mobile render, all head clicks, relocation and all existing attacks verified; no browser errors.');
} finally {
  if (browser) await browser.close();
  await server.close();
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SUMMONED_MONSTERS } from '../src/game/summoned-monsters.ts';

test('the three wave-specific Spine bosses have local textures, compatible atlas regions and idle animations', () => {
  for (const boss of SUMMONED_MONSTERS) {
    const jsonUrl = new URL(`../public/codmos-assets/${boss.json}`, import.meta.url);
    const atlasUrl = new URL(`../public/codmos-assets/${boss.atlas}`, import.meta.url);
    const json = JSON.parse(readFileSync(jsonUrl, 'utf8'));
    const atlas = readFileSync(atlasUrl, 'utf8');
    assert.ok(json.animations.idle, boss.name);
    const pageName = atlas.split(/\r?\n/).find(line => line.endsWith('.png'))!;
    const pageUrl = new URL(pageName, atlasUrl);
    assert.ok(existsSync(pageUrl), `${boss.name}: ${pageName}`);
    const png = readFileSync(pageUrl);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const dimensions = atlas.match(/size: (\d+), (\d+)/)!;
    assert.equal(png.readUInt32BE(16), Number(dimensions[1]));
    assert.equal(png.readUInt32BE(20), Number(dimensions[2]));
    const regions = new Set(atlas.split(/\r?\n/).filter(line => line && !/^\s/.test(line)));
    for (const skin of json.skins) {
      for (const attachments of Object.values(skin.attachments ?? {}) as Record<string, { type?: string; path?: string }>[]) {
        for (const [name, attachment] of Object.entries(attachments)) {
          if (!attachment.type || attachment.type === 'region' || attachment.type === 'mesh') {
            assert.ok(regions.has(attachment.path ?? name), `${boss.name}: ${attachment.path ?? name}`);
          }
        }
      }
    }
  }
});

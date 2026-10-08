import Phaser from 'phaser';
import { DEFINE } from './room-definition';
import { isWalkable } from './walkable';

function fillLayer(layer: Phaser.Tilemaps.TilemapLayer, gids: readonly number[]): void {
  gids.forEach((gid, index) => {
    if (!gid) return;
    const tile = layer.putTileAt((gid & 0x1fffffff) - 1, index % DEFINE.ROOM_WIDTH, Math.floor(index / DEFINE.ROOM_WIDTH));
    if (!tile) return;
    tile.flipX = (gid & 0x80000000) !== 0;
    tile.flipY = (gid & 0x40000000) !== 0;
    if (gid & 0x20000000) tile.rotation = Math.PI / 2;
  });
}

export class Room {
  readonly floor: Phaser.Tilemaps.TilemapLayer;
  readonly grid: Phaser.GameObjects.Graphics;
  private readonly frontWall: Phaser.Tilemaps.TilemapLayer;

  constructor(scene: Phaser.Scene) {
    const map = scene.make.tilemap({ tileWidth: DEFINE.TILE_SIZE, tileHeight: DEFINE.TILE_SIZE, width: DEFINE.ROOM_WIDTH, height: DEFINE.ROOM_HEIGHT });
    const tiles = map.addTilesetImage('room-tiles', 'room-tiles', DEFINE.TILE_SIZE, DEFINE.TILE_SIZE, 0, 0, 0);
    if (!tiles) throw new Error('방 타일을 불러오지 못했습니다.');
    this.floor = map.createBlankLayer('room-floor', tiles, 0, 0)!;
    fillLayer(this.floor, DEFINE.ROOM_GIDS);
    this.floor.setDepth(0);
    // The LMS surface is served from an authenticated CDN. This local floor
    // keeps the original geometry while giving the sandbox its teal palette.
    const surface = scene.add.graphics().setDepth(1);
    for (let y = 0; y < DEFINE.ROOM_HEIGHT; y++) {
      for (let x = 0; x < DEFINE.ROOM_WIDTH; x++) {
        if (!isWalkable(x, y)) continue;
        surface.fillStyle((x + y) % 2 === 0 ? 0x243c44 : 0x263f47);
        surface.fillRect(x * 100, y * 100, 100, 100);
        surface.lineStyle(2, 0x557078, 0.6);
        surface.strokeRect(x * 100, y * 100, 100, 100);
        surface.lineStyle(1, 0x102c34, 0.4);
        surface.lineBetween(x * 100 + 30, y * 100, x * 100 + 30, y * 100 + 100);
        surface.lineBetween(x * 100 + 70, y * 100, x * 100 + 70, y * 100 + 100);
      }
    }
    for (let y = 1; y <= 2; y++) {
      for (let x = 2; x <= 13; x++) {
        const tile = this.floor.getTileAt(x, y);
        if (tile) tile.tint = x === 7 || x === 8 ? 0x9ef2ef : 0x193840;
      }
    }
    // Keep the entrance independent so hiding the front wall never hides the door.
    const isDoor = (index: number) => {
      const x = index % DEFINE.ROOM_WIDTH, y = Math.floor(index / DEFINE.ROOM_WIDTH);
      return (x === 7 || x === 8) && (y === 2 || y === 3);
    };
    this.frontWall = map.createBlankLayer('room-front-wall', tiles, 0, DEFINE.ROOM_DECO_START_Y * DEFINE.TILE_SIZE)!;
    fillLayer(this.frontWall, DEFINE.ROOM_DECO_GIDS.map((gid, index) => isDoor(index) ? 0 : gid));
    this.frontWall.setDepth(100);
    const entrance = map.createBlankLayer('room-entrance', tiles, 0, DEFINE.ROOM_DECO_START_Y * DEFINE.TILE_SIZE)!;
    fillLayer(entrance, DEFINE.ROOM_DECO_GIDS.map((gid, index) => isDoor(index) ? gid : 0));
    entrance.setDepth(2);
    this.grid = scene.add.graphics().setDepth(2).setVisible(false);
    this.grid.lineStyle(2, 0x80e5e0, 0.22);
    for (let y = 0; y < DEFINE.ROOM_HEIGHT; y++) {
      for (let x = 0; x < DEFINE.ROOM_WIDTH; x++) {
        if (isWalkable(x, y)) this.grid.strokeRect(x * 100, y * 100, 100, 100);
      }
    }
  }

  updateWall(frontmostUnitY: number): void {
    this.frontWall.setVisible(frontmostUnitY < DEFINE.ROOM_DECO_START_Y);
  }
}

import { DEFINE } from './room-definition.ts';

export function isWalkable(x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || x >= DEFINE.ROOM_WIDTH || y < 0 || y >= DEFINE.ROOM_HEIGHT) return false;
  // The front facade covers otherwise walkable tiles in the base floor layer.
  const wallRow = DEFINE.ROOM_FRONT_WALL_TILES[y - DEFINE.ROOM_DECO_START_Y];
  if (wallRow?.[x] === 1) return false;
  return (DEFINE.ROOM_GIDS[y * DEFINE.ROOM_WIDTH + x] & 0x1fffffff) === 24;
}

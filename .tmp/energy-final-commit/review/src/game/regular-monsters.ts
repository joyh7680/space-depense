// The numbers match the user's reference: mint (1), green (2), orange (3).
export const REGULAR_MONSTERS = [
  { texture: 'monster-mint', file: 'monster-mint.png' },
  { texture: 'monster-green', file: 'monster-green.png' },
  { texture: 'monster-orange', file: 'monster-orange.png' },
] as const;

export function getRegularMonster(wave: number) {
  return REGULAR_MONSTERS[Math.min(3, Math.max(1, Math.trunc(wave))) - 1];
}

export const MONSTER_ASSET_PATH = 'codmos-assets/monster/';

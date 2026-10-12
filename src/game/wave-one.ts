import type { RobotKind, TilePosition } from './types.ts';

// First-wave tuning is independent of the renderer.
const spawnInterval = 1.65;
const summonDelay = 100;
// Expected regular spawns before the boss arrives; this is not a spawn limit.
export const WAVE_ONE = { enemies: Math.ceil(summonDelay / spawnInterval), health: 68, speed: 0.65, spawnInterval, elementEnergyReward: 1, killEnergy: 15, clearEnergy: 50 } as const;
// Minimum cost; each robot's actual energy cost is defined by its recipe below.
export const ROBOT_CHARGE_COST = 5;
export const MAX_ROBOTS = 9;
export const SUMMONED_MONSTER = { summonDelay, health: WAVE_ONE.health * 10, size: 150, elementEnergyReward: 3, robotDropChance: 0.02 } as const;
export const MAX_GRADE = 3;
export const ROBOT_KINDS: readonly RobotKind[] = ['fire', 'ice', 'electric'];
export const ELEMENTS = {
  fire: { name: '화염', color: 0xffac70, symbol: '♨' },
  ice: { name: '냉기', color: 0x88d9ff, symbol: '❄' },
  electric: { name: '전기', color: 0xffd65c, symbol: 'ϟ' },
} as const;
// Kind keys retain the existing character skins and coding mission families.
export const ROBOTS = {
  fire: { name: '플라즈마', color: 0xd78aff, damage: 19, description: '강력한 폭발 피해', recipe: [{ kind: 'fire', amount: 5 }, { kind: 'electric', amount: 4 }] },
  ice: { name: '써멀 쇼크', color: 0xffad65, damage: 20, description: '광역 충격 공격', recipe: [{ kind: 'ice', amount: 4 }, { kind: 'fire', amount: 3 }] },
  electric: { name: '크라이오 볼트', color: 0x7eeaff, damage: 22, description: '감전 + 둔화', recipe: [{ kind: 'electric', amount: 3 }, { kind: 'ice', amount: 2 }] },
} as const;
export const DEPLOY_SLOTS: readonly TilePosition[] = [
  { x: 3, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 }, { x: 11, y: 5 },
  { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 8, y: 5 }, { x: 10, y: 5 },
];

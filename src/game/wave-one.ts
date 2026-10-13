import type { RobotKind, TilePosition } from './types.ts';

// First-wave tuning is independent of the renderer.
const spawnInterval = 1.65;
export const REGULAR_ENEMY_COUNTS = [50, 70, 90] as const;
export const WAVE_ONE = { enemies: REGULAR_ENEMY_COUNTS[0], health: 68, speed: 0.65, spawnInterval, elementEnergyReward: 1, killEnergy: 15, clearEnergy: 50 } as const;
// Minimum cost; each robot's actual energy cost is defined by its recipe below.
export const ROBOT_CHARGE_COST = 4;
export const MAX_ROBOTS = 9;
export const SUMMONED_MONSTER = { summonDelay: 100, health: WAVE_ONE.health * 10, size: 150, elementEnergyReward: 3, robotDropChance: 0.02 } as const;
export const MAX_GRADE = 3;
// World-space radii: the shared robot circle matches the red reference outline.
export const ROBOT_ATTACK_RADIUS = 190;
export const PLAYER_LASER_RADIUS = ROBOT_ATTACK_RADIUS;
export const ROBOT_KINDS: readonly RobotKind[] = ['fire', 'ice', 'electric'];
export const ELEMENTS = {
  fire: { name: '화염', color: 0xffac70, symbol: '♨' },
  ice: { name: '냉기', color: 0x88d9ff, symbol: '❄' },
  electric: { name: '전기', color: 0xffd65c, symbol: 'ϟ' },
} as const;
// Kind keys retain the existing character skins and coding mission families.
export const ROBOTS = {
  fire: { name: '플라즈마', color: 0xd78aff, damage: 19, attackRadius: ROBOT_ATTACK_RADIUS, attackInterval: 1.2, description: '근거리 에너지탄 공격 + 주변 폭발 피해', recipe: [{ kind: 'fire', amount: 4 }, { kind: 'electric', amount: 2 }, { kind: 'ice', amount: 1 }] },
  ice: { name: '써멀 쇼크', color: 0xffad65, damage: 20, attackRadius: ROBOT_ATTACK_RADIUS, attackInterval: 0.9, description: '근거리 냉열 충격파 + 이동속도 감소', recipe: [{ kind: 'ice', amount: 3 }, { kind: 'fire', amount: 1 }, { kind: 'electric', amount: 1 }] },
  electric: { name: '크라이오 볼트', color: 0x7eeaff, damage: 22, attackRadius: ROBOT_ATTACK_RADIUS, attackInterval: 0.4, description: '근거리 몬스터 빠른 공격', recipe: [{ kind: 'electric', amount: 2 }, { kind: 'ice', amount: 1 }, { kind: 'fire', amount: 1 }] },
} as const;
export const DEPLOY_SLOTS: readonly TilePosition[] = [
  { x: 3, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 }, { x: 11, y: 5 },
  { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 8, y: 5 }, { x: 10, y: 5 },
];

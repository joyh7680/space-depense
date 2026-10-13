import type { RobotKind, TilePosition } from './types.ts';

// First-wave tuning is independent of the renderer.
const spawnInterval = 1.65;
export const REGULAR_ENEMY_COUNTS = [50, 70, 90] as const;
export const WAVE_ONE = { enemies: REGULAR_ENEMY_COUNTS[0], health: 100, speed: 0.65, spawnInterval, elementEnergyReward: 1, killEnergy: 15, clearEnergy: 50 } as const;
// Minimum cost; each robot's actual energy cost is defined by its recipe below.
export const ROBOT_CHARGE_COST = 4;
export const MAX_ROBOTS = 9;
export const SUMMONED_MONSTER = { summonDelay: 100, warningLeadTime: 5, health: WAVE_ONE.health * 10, size: 150, elementEnergyReward: 3, robotDropChance: 0.02 } as const;
export const MAX_GRADE = 3;
// World-space range: circular bolt/blast range and straight beam length.
export const ROBOT_ATTACK_RADIUS = 190;
export const PLAYER_LASER_RADIUS = 150;
export const ROBOT_KINDS: readonly RobotKind[] = ['fire', 'ice', 'electric'];
export const ELEMENTS = {
  fire: { name: '화염', color: 0xffac70, symbol: '♨' },
  ice: { name: '냉기', color: 0x88d9ff, symbol: '❄' },
  electric: { name: '전기', color: 0xffd65c, symbol: 'ϟ' },
} as const;
// Kind keys retain the existing character skins and coding mission families.
export const ROBOTS = {
  fire: { name: '플라즈마', color: 0xd78aff, damage: 90, attackRadius: ROBOT_ATTACK_RADIUS, attackInterval: 1.2, chargeDuration: 0.5, effectDuration: 1.3, description: '0.5초 충전 후 로봇 중심 범위 전체에 90HP 플라즈마 폭발', recipe: [{ kind: 'fire', amount: 3 }, { kind: 'electric', amount: 2 }, { kind: 'ice', amount: 2 }] },
  ice: { name: '써멀 쇼크', color: 0xffad65, damage: 45, attackRadius: ROBOT_ATTACK_RADIUS, attackInterval: 0.9, chargeDuration: 0, effectDuration: 1.2, description: '냉기·화염 직선 빔으로 경로의 모든 적에게 45HP 관통 피해', recipe: [{ kind: 'ice', amount: 2 }, { kind: 'fire', amount: 2 }, { kind: 'electric', amount: 1 }] },
  electric: { name: '크라이오 볼트', color: 0x7eeaff, damage: 30, attackRadius: ROBOT_ATTACK_RADIUS, attackInterval: 0.4, chargeDuration: 0, effectDuration: 0.8, description: '가장 가까운 적에게 30HP 전기 볼트 + 2초 동안 이동속도 30% 감소', recipe: [{ kind: 'electric', amount: 2 }, { kind: 'ice', amount: 1 }, { kind: 'fire', amount: 1 }] },
} as const;
export const DEPLOY_SLOTS: readonly TilePosition[] = [
  { x: 3, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 }, { x: 11, y: 5 },
  { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 8, y: 5 }, { x: 10, y: 5 },
];

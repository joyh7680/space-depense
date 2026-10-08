import type { RobotKind, TilePosition } from './types.ts';

// First-wave tuning is independent of the renderer.
export const WAVE_ONE = { enemies: 12, health: 68, speed: 0.65, spawnInterval: 1.65, killEnergy: 15, clearEnergy: 50 } as const;
export const SUMMON_COST = 75;
export const MAX_GRADE = 3;
export const ROBOT_KINDS: readonly RobotKind[] = ['fire', 'ice', 'electric'];
export const ROBOTS = {
  fire: { name: '화염', color: 0xffac70, damage: 19, range: 3.2, description: '화염탄 + 2초간 지속 피해', symbol: '♨' },
  ice: { name: '냉기', color: 0x88d9ff, damage: 20, range: 3.4, description: '얼음탄 + 잠시 이동속도 감소', symbol: '❄' },
  electric: { name: '전기', color: 0xc6a4ff, damage: 22, range: 3.2, description: '전기탄 + 주변 적 1마리 연쇄 피해', symbol: 'ϟ' },
} as const;
export const DEPLOY_SLOTS: readonly TilePosition[] = [
  { x: 3, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 }, { x: 11, y: 5 },
  { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 8, y: 5 }, { x: 10, y: 5 },
];

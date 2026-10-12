import type { RobotKind } from './types.ts';

export const CODING_BLOCKS = {
  find: { label: '목표 찾기', category: 'action' },
  missile: { label: '미사일 발사하기', category: 'action' },
  cool: { label: '냉각 공격', category: 'action' },
  shock: { label: '전기 충격 발사', category: 'action' },
  'repeat-two': { label: '2번 반복하기', category: 'loop' },
  'in-range': { label: '만약 적이 사거리 안에 있다면', category: 'condition' },
} as const;
export type CodingBlockId = keyof typeof CODING_BLOCKS;
export type RobotCode = (CodingBlockId | null)[];
export type MissionNumber = 1 | 2 | 3;
export type MissionProgress = { code: RobotCode; status: 'waiting' | 'error' | 'completed'; message: string };
export type RobotProgram = Record<MissionNumber, MissionProgress>;
export type CodingMission = {
  number: MissionNumber; title: string;
  concept: string; summary: string; description: string; effect: string;
  slots: { block: CodingBlockId; depth: number; hint: string }[];
  palette: CodingBlockId[];
};
const BASIC_ACTIONS: Record<RobotKind, CodingBlockId> = { fire: 'missile', ice: 'cool', electric: 'shock' };

export function getMissionNumber(wave: number): MissionNumber {
  return Math.min(3, Math.max(1, Math.trunc(wave))) as MissionNumber;
}

export function getCodingMission(kind: RobotKind, wave: number): CodingMission {
  const number = getMissionNumber(wave);
  const action = BASIC_ACTIONS[kind];
  const command = CODING_BLOCKS[action].label;
  const control = ({ 1: 'find', 2: 'repeat-two', 3: 'in-range' } as const)[number];
  const blocks = [control, action];
  return {
    number,
    title: ({ 1: '기본 미션', 2: '중간 미션', 3: '강화 미션' } as const)[number],
    concept: ({ 1: '순차 실행', 2: '반복문', 3: '조건문' } as const)[number],
    summary: ({
      1: `목표를 찾고 ${command} 명령을 실행하세요.`,
      2: `${command} 명령을 2번 반복하세요.`,
      3: `적이 사거리 안에 있다면 ${command} 명령을 실행하세요.`,
    } as const)[number],
    description: ({
      1: '목표 찾기 다음에 공격 명령을 연결해 순서대로 실행해요.',
      2: '반복 블록 안에 공격 명령을 넣어 반복문을 완성해요.',
      3: '조건 블록 안에 공격 명령을 넣어 조건문을 완성해요.',
    } as const)[number],
    effect: '성공하면 이번 웨이브에서 이 로봇의 기본 자동 공격이 활성화돼요.',
    slots: blocks.map((block, index) => ({ block, depth: number > 1 && index === 1 ? 1 : 0, hint: CODING_BLOCKS[block].label })),
    palette: [action, control],
  };
}

export function createMissionProgress(kind: RobotKind, number: MissionNumber): MissionProgress {
  return {
    code: getCodingMission(kind, number).slots.map(() => null), status: 'waiting',
    message: '블록을 올바르게 연결하면 이 로봇의 기본 자동 공격이 활성화돼요.',
  };
}

export function createRobotProgram(kind: RobotKind): RobotProgram {
  return { 1: createMissionProgress(kind, 1), 2: createMissionProgress(kind, 2), 3: createMissionProgress(kind, 3) };
}

export function isCodingBlock(value: string): value is CodingBlockId { return Object.hasOwn(CODING_BLOCKS, value); }
export function validateRobotCode(kind: RobotKind, wave: number, code: readonly (CodingBlockId | null)[]): { success: boolean; message: string } {
  const mission = getCodingMission(kind, wave);
  if (code.length !== mission.slots.length || code.some(block => block === null)) return { success: false, message: '빈칸이 있어요. 모든 칸에 명령어 블록을 넣어 주세요.' };
  const wrong = mission.slots.findIndex((slot, index) => code[index] !== slot.block);
  if (wrong !== -1) return { success: false, message: (wrong + 1) + '번째 블록을 확인해 주세요. ' + mission.slots[wrong].hint + '.' };
  return { success: true, message: '공격 성공! 이 로봇의 기본 자동 공격이 활성화됐어요.' };
}

export type AttackProfile = {
  shots: number; damage: number; splash: number; burn: number;
  slowDuration: number; slowFactor: number; chainTargets: number; chainDamage: number; area: boolean;
};
// Mission concepts are learning exercises; combat always uses the robot's basic attack.
export function getBasicRobotAttack(kind: RobotKind): AttackProfile {
  return {
    shots: kind === 'electric' ? 2 : 1, damage: 1,
    splash: kind === 'fire' ? 1.6 : 0, burn: kind === 'fire' ? 0.2 : 0,
    slowDuration: kind === 'ice' ? 1.4 : 0, slowFactor: 0.6,
    chainTargets: kind === 'electric' ? 1 : 0, chainDamage: 0.5, area: false,
  };
}

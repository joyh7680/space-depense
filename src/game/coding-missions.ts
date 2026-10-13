import type { RobotKind } from './types.ts';
import { ROBOTS } from './wave-one.ts';

export const CODING_BLOCKS = {
  find: { label: '목표 찾기', category: 'action' },
  missile: { label: '플라즈마 폭발 발사', category: 'action' },
  cool: { label: '써멀 쇼크 관통 빔 발사', category: 'action' },
  shock: { label: '크라이오 볼트 둔화 볼트 발사', category: 'action' },
  'repeat-two': { label: '2번 반복하기', category: 'loop' },
  'enemy-present': { label: '만약 적이 있다면', category: 'condition' },
  aim: { label: '조준하기', category: 'action' },
  charge: { label: '공격 에너지 충전하기', category: 'action' },
  scan: { label: '주변 탐색하기', category: 'action' },
  shield: { label: '보호막 켜기', category: 'action' },
  'enemy-fast': { label: '만약 빠른 적이라면', category: 'condition' },
  'enemy-armored': { label: '만약 보호막이 있는 적이라면', category: 'condition' },
} as const;
export type CodingBlockId = keyof typeof CODING_BLOCKS | `target-${number}` | `repeat-${number}`;
export function getCodingBlock(block: CodingBlockId): { label: string; category: 'action' | 'loop' | 'condition' } {
  if (block.startsWith('target-')) return { label: `${block.slice(7)}번 목표 찾기`, category: 'action' };
  if (block.startsWith('repeat-') && block !== 'repeat-two') return { label: `${block.slice(7)}번 반복하기`, category: 'loop' };
  return CODING_BLOCKS[block as keyof typeof CODING_BLOCKS];
}
export type RobotCode = (CodingBlockId | null)[];
export type MissionNumber = 1 | 2 | 3;
export type MissionProgress = { code: RobotCode; status: 'waiting' | 'error' | 'completed'; message: string };
export type RobotProgram = Record<MissionNumber, MissionProgress>;
export type CodingMission = {
  number: MissionNumber; title: string;
  deploymentOrder: number; maxBlocks: number;
  concept: string; summary: string; description: string; effect: string;
  slots: { block: CodingBlockId; depth: number; hint: string }[];
  palette: CodingBlockId[];
};
const BASIC_ACTIONS: Record<RobotKind, CodingBlockId> = { fire: 'missile', ice: 'cool', electric: 'shock' };
const BLOCK_COUNTS = { 1: [1, 2, 3, 3, 3], 2: [2, 2, 3, 4, 4], 3: [2, 3, 3, 4, 5] } as const;

export function getMissionNumber(wave: number): MissionNumber {
  return Math.min(3, Math.max(1, Math.trunc(wave))) as MissionNumber;
}

export function getCodingMission(kind: RobotKind, wave: number, variant = 0): CodingMission {
  const number = getMissionNumber(wave);
  const deploymentOrder = Math.max(1, Math.trunc(variant) + 1);
  const count = BLOCK_COUNTS[number][Math.min(deploymentOrder, 5) - 1];
  const action = BASIC_ACTIONS[kind];
  const target: CodingBlockId = `target-${deploymentOrder}`;
  const preparation = (['aim', 'charge', 'scan', 'shield'] as const)[(deploymentOrder - 1) % 4];
  const nextPreparation = (['aim', 'charge', 'scan', 'shield'] as const)[deploymentOrder % 4];
  let answer: CodingBlockId[];
  let depths: number[];
  let summary: string;
  let description: string;
  if (number === 1) {
    answer = count === 1 ? [action] : count === 2 ? [target, action] : [target, preparation, action];
    depths = answer.map(() => 0);
    summary = `${answer.map(block => getCodingBlock(block).label).join(' → ')} 순서로 실행하세요.`;
    description = '명령을 위에서 아래로 연결해 순서대로 실행해요.';
  } else if (number === 2) {
    const repeat: CodingBlockId = deploymentOrder === 1 ? 'repeat-two' : `repeat-${deploymentOrder + 1}`;
    const body = count === 2 ? [action] : count === 3 ? [preparation, action] : [target, preparation, action];
    answer = [repeat, ...body];
    depths = [0, ...body.map(() => 1)];
    summary = `${body.map(block => getCodingBlock(block).label).join(' → ')} 동작을 ${deploymentOrder + 1}번 반복하세요.`;
    description = '반복 블록 안에 명령을 순서대로 넣어요. 반복하기 블록도 1개로 세어요.';
  } else {
    const condition = (['enemy-present', 'enemy-fast', 'enemy-armored'] as const)[(deploymentOrder - 1) % 3];
    const prefix = count === 2 ? [] : [target];
    const body = count <= 3 ? [action] : count === 4 ? [preparation, action] : [preparation, nextPreparation, action];
    answer = [...prefix, condition, ...body];
    depths = [...prefix.map(() => 0), 0, ...body.map(() => 1)];
    summary = `${prefix.length ? getCodingBlock(target).label + ' 후, ' : ''}${getCodingBlock(condition).label} ${body.map(block => getCodingBlock(block).label).join(' → ')} 순서로 실행하세요.`;
    description = '조건이 맞을 때 실행할 명령을 조건 블록 안에 넣어요. 만약 블록도 1개로 세어요.';
  }
  return {
    number,
    deploymentOrder, maxBlocks: BLOCK_COUNTS[number][4],
    title: ({ 1: '기본 미션', 2: '중간 미션', 3: '강화 미션' } as const)[number],
    concept: ({ 1: '순차 실행', 2: '반복문', 3: '조건문' } as const)[number],
    summary, description,
    effect: '성공하면 이번 웨이브에서 이 로봇의 기본 자동 공격이 활성화돼요.',
    slots: answer.map((block, index) => ({ block, depth: depths[index], hint: getCodingBlock(block).label })),
    palette: [...answer].reverse(),
  };
}

export function createMissionProgress(kind: RobotKind, number: MissionNumber, variant = 0): MissionProgress {
  return {
    code: getCodingMission(kind, number, variant).slots.map(() => null), status: 'waiting',
    message: '블록을 올바르게 연결하면 이 로봇의 기본 자동 공격이 활성화돼요.',
  };
}

export function createRobotProgram(kind: RobotKind, variant = 0): RobotProgram {
  return { 1: createMissionProgress(kind, 1, variant), 2: createMissionProgress(kind, 2, variant), 3: createMissionProgress(kind, 3, variant) };
}

export function isCodingBlock(value: string): value is CodingBlockId {
  return Object.hasOwn(CODING_BLOCKS, value) || /^(target|repeat)-[1-9]\d*$/.test(value);
}
export function validateRobotCode(kind: RobotKind, wave: number, code: readonly (CodingBlockId | null)[], variant = 0): { success: boolean; message: string } {
  const mission = getCodingMission(kind, wave, variant);
  if (code.length !== mission.slots.length || code.some(block => block === null)) return { success: false, message: '빈칸이 있어요. 모든 칸에 명령어 블록을 넣어 주세요.' };
  const wrong = mission.slots.findIndex((slot, index) => code[index] !== slot.block);
  if (wrong !== -1) return { success: false, message: (wrong + 1) + '번째 블록을 확인해 주세요. ' + mission.slots[wrong].hint + '.' };
  return { success: true, message: '공격 성공! 이 로봇의 기본 자동 공격이 활성화됐어요.' };
}

export type AttackProfile = {
  attackRadius: number; attackInterval: number;
  mode: 'bolt' | 'beam' | 'blast'; chargeDuration: number; effectDuration: number; beamHalfWidth: number;
  shots: number; damage: number; splash: number; burn: number;
  slowDuration: number; slowFactor: number; chainTargets: number; chainDamage: number; area: boolean;
};
// Mission concepts are learning exercises; combat always uses the robot's basic attack.
export function getBasicRobotAttack(kind: RobotKind): AttackProfile {
  return {
    attackRadius: ROBOTS[kind].attackRadius, attackInterval: ROBOTS[kind].attackInterval,
    mode: kind === 'electric' ? 'bolt' : kind === 'ice' ? 'beam' : 'blast',
    chargeDuration: ROBOTS[kind].chargeDuration, effectDuration: ROBOTS[kind].effectDuration,
    beamHalfWidth: 20,
    shots: 1, damage: 1, splash: 0, burn: 0,
    slowDuration: kind === 'electric' ? 2 : 0, slowFactor: 0.7,
    chainTargets: 0, chainDamage: 0, area: kind === 'fire',
  };
}

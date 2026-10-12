import type { RobotKind } from './types.ts';

export const CODING_BLOCKS = {
  find: { label: '목표 찾기', category: 'action' },
  missile: { label: '플라즈마 폭발 발사', category: 'action' },
  cool: { label: '써멀 쇼크 광역 공격', category: 'action' },
  shock: { label: '크라이오 볼트 발사', category: 'action' },
  'repeat-two': { label: '2번 반복하기', category: 'loop' },
  'in-range': { label: '만약 적이 사거리 안에 있다면', category: 'condition' },
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
  concept: string; summary: string; description: string; effect: string;
  slots: { block: CodingBlockId; depth: number; hint: string }[];
  palette: CodingBlockId[];
};
const BASIC_ACTIONS: Record<RobotKind, CodingBlockId> = { fire: 'missile', ice: 'cool', electric: 'shock' };
const SEQUENCE_STEPS: readonly (readonly CodingBlockId[])[] = [
  ['find', 'aim'], ['charge', 'find'], ['scan', 'find'],
  ['shield', 'find', 'aim'], ['find', 'charge', 'aim'], ['scan', 'shield', 'find'],
  ['find', 'aim', 'shield'], ['charge', 'scan', 'find'], ['scan', 'find', 'aim'],
];

export function getMissionNumber(wave: number): MissionNumber {
  return Math.min(3, Math.max(1, Math.trunc(wave))) as MissionNumber;
}

export function getCodingMission(kind: RobotKind, wave: number, variant = 0): CodingMission {
  const number = getMissionNumber(wave);
  const action = BASIC_ACTIONS[kind];
  const command = getCodingBlock(action).label;
  const control = ({ 1: 'find', 2: 'repeat-two', 3: 'in-range' } as const)[number];
  const blocks: CodingBlockId[] = [control, action];
  const mission: CodingMission = {
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
    slots: blocks.map((block, index) => ({ block, depth: number > 1 && index === 1 ? 1 : 0, hint: getCodingBlock(block).label })),
    palette: [action, control],
  };
  if (variant === 0) return mission;

  const target: CodingBlockId = `target-${variant + 1}`;
  const preparation = (['aim', 'charge', 'scan', 'shield'] as const)[(variant - 1) % 4];
  let answer: CodingBlockId[];
  if (number === 1) {
    const steps = SEQUENCE_STEPS[(variant - 1) % SEQUENCE_STEPS.length];
    answer = [...steps.map(block => block === 'find' ? target : block), action];
    mission.summary = `${answer.map(block => getCodingBlock(block).label).join(' → ')} 순서로 실행하세요.`;
    mission.description = '지정된 목표와 준비 명령의 순서를 확인하고 마지막에 공격 명령을 연결해요.';
  } else if (number === 2) {
    const repeat: CodingBlockId = `repeat-${variant + 2}`;
    answer = [repeat, preparation, action];
    mission.summary = `${getCodingBlock(preparation).label} 다음 ${command} 명령을 실행하는 동작을 ${variant + 2}번 반복하세요.`;
    mission.description = '지정된 횟수의 반복 블록 안에 준비 명령과 공격 명령을 순서대로 넣어요.';
  } else {
    const condition = (['in-range', 'enemy-fast', 'enemy-armored'] as const)[(variant - 1) % 3];
    answer = [target, condition, preparation, action];
    mission.summary = `${getCodingBlock(target).label} 후, ${getCodingBlock(condition).label.replace('만약 ', '')} ${getCodingBlock(preparation).label} 다음 ${command} 명령을 실행하세요.`;
    mission.description = '목표 찾기 다음에 조건 블록을 연결하고, 조건 안에 준비 명령과 공격 명령을 넣어요.';
  }
  mission.slots = answer.map((block, index) => ({ block,
    depth: (number === 2 && index > 0) || (number === 3 && index > 1) ? 1 : 0,
    hint: getCodingBlock(block).label,
  }));
  // The available answer blocks belong to this specific question.
  mission.palette = [...answer.slice(1), answer[0]].reverse();
  return mission;
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
  shots: number; damage: number; splash: number; burn: number;
  slowDuration: number; slowFactor: number; chainTargets: number; chainDamage: number; area: boolean;
};
// Mission concepts are learning exercises; combat always uses the robot's basic attack.
export function getBasicRobotAttack(kind: RobotKind): AttackProfile {
  return {
    shots: kind === 'electric' ? 2 : 1, damage: 1,
    splash: kind === 'fire' ? 1.6 : kind === 'ice' ? 1.4 : 0, burn: kind !== 'electric' ? 0.2 : 0,
    slowDuration: kind !== 'fire' ? 1.4 : 0, slowFactor: 0.6,
    chainTargets: kind === 'electric' ? 1 : 0, chainDamage: 0.5, area: false,
  };
}

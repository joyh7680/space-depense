import type { RobotKind } from './types.ts';

export type CodingBlockId = 'nearby-two' | 'in-range' | 'repeat-three' | 'enemy-count' | 'count-three' | 'chain' | 'freeze' | 'missile';
export type RobotCode = (CodingBlockId | null)[];
export const CODING_BLOCKS: Record<CodingBlockId, { label: string; category: 'condition' | 'loop' | 'variable' | 'action' }> = {
  'nearby-two': { label: '만약 주변 외계인 수 ≥ 2 라면', category: 'condition' },
  'in-range': { label: '만약 외계인이 사정거리 안에 있다면', category: 'condition' },
  'repeat-three': { label: '3번 반복하기', category: 'loop' },
  'enemy-count': { label: '변수 적의수 = 주변 외계인 수', category: 'variable' },
  'count-three': { label: '만약 적의수 ≥ 3 이라면', category: 'condition' },
  chain: { label: '연쇄 전기 공격하기', category: 'action' },
  freeze: { label: '얼음 공격하기', category: 'action' },
  missile: { label: '범위 미사일 발사하기', category: 'action' },
};
export type CodingMission = {
  number: number; autoRun: boolean;
  concept: string; description: string; effect: string;
  slots: { block: CodingBlockId; depth: number; hint: string }[];
  palette: CodingBlockId[];
};
const ROBOT_ACTIONS: Record<RobotKind, CodingBlockId> = {
  electric: 'chain', ice: 'freeze', fire: 'missile',
};

export function getCodingMission(kind: RobotKind, wave: number): CodingMission {
  const action = ROBOT_ACTIONS[kind];
  const label = CODING_BLOCKS[action].label;
  // Preparation before the first wave uses the same one-block practice mission.
  const number = Math.min(3, Math.max(1, Math.trunc(wave)));
  if (number === 1) return {
    number, autoRun: true,
    concept: '연습 · 공격 블록 1개', description: `${label} 블록을 한 번 눌러 로봇의 공격을 시작해 봐요!`,
    effect: '공격 블록 1개를 클릭하면 바로 공격이 활성화돼요. 사정거리 안의 외계인을 공격해요.',
    slots: [{ block: action, depth: 0, hint: `${label} 블록을 눌러 주세요` }],
    palette: [action],
  };
  if (number === 2) return {
    number, autoRun: false,
    concept: '조건문 · 블록 2개', description: `외계인이 사정거리 안에 있다면 ${label}!`,
    effect: '사정거리 조건과 공격 블록 2개를 순서대로 넣고 코드를 실행해 봐요.',
    slots: [{ block: 'in-range', depth: 0, hint: '외계인이 가까이 왔나요?' }, { block: action, depth: 1, hint: '조건이 맞으면 공격해요' }],
    palette: [action, 'in-range'],
  };
  return {
    number, autoRun: false,
    concept: '변수 + 조건문 · 블록 3개', description: `주변 외계인이 3마리 이상이면 ${label}!`,
    effect: '주변 외계인 수를 변수에 저장하고, 3마리 이상이면 공격해요.',
    slots: [{ block: 'enemy-count', depth: 0, hint: '외계인 수를 변수에 저장해요' }, { block: 'count-three', depth: 0, hint: '저장한 적의수를 확인해요' }, { block: action, depth: 1, hint: '조건이 맞으면 공격해요' }],
    palette: [action, 'count-three', 'enemy-count'],
  };
}

export function isCodingBlock(value: string): value is CodingBlockId {
  return Object.hasOwn(CODING_BLOCKS, value);
}

export function validateRobotCode(kind: RobotKind, wave: number, code: readonly (CodingBlockId | null)[]): { success: boolean; message: string } {
  const mission = getCodingMission(kind, wave);
  if (code.length !== mission.slots.length || code.some(block => block === null)) {
    return { success: false, message: '빈칸이 있어요. 모든 칸에 명령어 블록을 넣어 주세요.' };
  }
  const wrong = mission.slots.findIndex((slot, index) => code[index] !== slot.block);
  if (wrong !== -1) return { success: false, message: `${wrong + 1}번째 블록을 확인해 주세요. ${mission.slots[wrong].hint}.` };
  return { success: true, message: mission.autoRun ? '연습 성공! 블록 1개로 공격이 활성화됐어요.' : '코딩 성공! 로봇이 조건을 확인하며 공격을 시작해요.' };
}

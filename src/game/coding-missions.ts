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
export const CODING_MISSIONS: Record<RobotKind, {
  concept: string; description: string; effect: string;
  slots: { block: CodingBlockId; depth: number; hint: string }[];
  palette: CodingBlockId[];
}> = {
  electric: {
    concept: '조건문', description: '주변에 외계인이 2마리 이상 있다면 연쇄 전기 공격을 해줘!',
    effect: '사정거리 안에 외계인이 2마리 이상이면 전기로 연결해 공격해요.',
    slots: [{ block: 'nearby-two', depth: 0, hint: '조건을 확인해요' }, { block: 'chain', depth: 1, hint: '조건이 맞으면 공격해요' }],
    palette: ['chain', 'nearby-two', 'missile'],
  },
  ice: {
    concept: '조건문 + 반복문', description: '외계인이 가까이 오면 얼음 공격을 3번 반복해서 얼려줘!',
    effect: '사정거리 안의 외계인에게 얼음탄을 3번 쏘고 이동 속도를 낮춰요.',
    slots: [{ block: 'in-range', depth: 0, hint: '외계인이 가까이 왔나요?' }, { block: 'repeat-three', depth: 1, hint: '몇 번 반복할까요?' }, { block: 'freeze', depth: 2, hint: '반복할 공격을 넣어요' }],
    palette: ['freeze', 'repeat-three', 'in-range', 'chain'],
  },
  fire: {
    concept: '변수 + 조건문', description: '주변 외계인이 3마리 이상이면 미사일을 발사해줘!',
    effect: '주변 외계인 수를 변수에 저장하고, 3마리 이상이면 범위 피해를 줘요.',
    slots: [{ block: 'enemy-count', depth: 0, hint: '외계인 수를 변수에 저장해요' }, { block: 'count-three', depth: 0, hint: '저장한 적의수를 확인해요' }, { block: 'missile', depth: 1, hint: '조건이 맞으면 공격해요' }],
    palette: ['missile', 'count-three', 'enemy-count', 'nearby-two'],
  },
};

export function isCodingBlock(value: string): value is CodingBlockId {
  return Object.hasOwn(CODING_BLOCKS, value);
}

export function validateRobotCode(kind: RobotKind, code: readonly (CodingBlockId | null)[]): { success: boolean; message: string } {
  const mission = CODING_MISSIONS[kind];
  if (code.length !== mission.slots.length || code.some(block => block === null)) {
    return { success: false, message: '빈칸이 있어요. 모든 칸에 명령어 블록을 넣어 주세요.' };
  }
  const wrong = mission.slots.findIndex((slot, index) => code[index] !== slot.block);
  if (wrong !== -1) return { success: false, message: `${wrong + 1}번째 블록을 확인해 주세요. ${mission.slots[wrong].hint}.` };
  return { success: true, message: '코딩 성공! 로봇이 조건을 확인하며 공격을 시작해요.' };
}

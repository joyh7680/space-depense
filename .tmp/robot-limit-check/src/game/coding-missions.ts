import type { RobotKind } from './types.ts';

export const CODING_BLOCKS = {
  find: { label: '목표 찾기', category: 'action' },
  missile: { label: '미사일 발사하기', category: 'action' },
  'in-range': { label: '만약 적이 사거리 안에 있다면', category: 'condition' },
  cool: { label: '냉각 공격', category: 'action' },
  'repeat-two': { label: '2번 반복하기', category: 'loop' },
  shock: { label: '전기 충격 발사', category: 'action' },
  'nearby-two': { label: '만약 주변 적이 2마리 이상이라면', category: 'condition' },
  'not-slowed': { label: '만약 목표가 냉각되지 않았다면', category: 'condition' },
  blast: { label: '폭발 미사일 발사하기', category: 'action' },
  freeze: { label: '주변 적 급속 냉각하기', category: 'action' },
  chain: { label: '강화 연쇄 전기 발사', category: 'action' },
  'target-health': { label: '변수 목표체력 = 목표의 현재 체력', category: 'variable' },
  'health-high': { label: '만약 목표체력 ≥ 100 이라면', category: 'condition' },
  'enemy-count': { label: '변수 적의수 = 사거리 안의 적 수', category: 'variable' },
  'count-three': { label: '만약 적의수 ≥ 3 이라면', category: 'condition' },
  'count-two': { label: '만약 적의수 ≥ 2 이라면', category: 'condition' },
  heavy: { label: '고위력 미사일 발사하기', category: 'action' },
  blizzard: { label: '사거리 전체 냉각 폭풍', category: 'action' },
  overload: { label: '3연속 광역 전기 충격', category: 'action' },
  else: { label: '아니라면', category: 'condition' },
} as const;
export type CodingBlockId = keyof typeof CODING_BLOCKS;
export type RobotCode = (CodingBlockId | null)[];
export type MissionNumber = 1 | 2 | 3;
export type EnhancementChoices = Record<2 | 3, RobotKind | null>;
export type MissionProgress = { code: RobotCode; status: 'waiting' | 'error' | 'completed'; message: string };
export type RobotProgram = Record<MissionNumber, MissionProgress>;
export type CodingMission = {
  number: MissionNumber; autoRun: boolean;
  concept: string; description: string; effect: string;
  slots: { block: CodingBlockId; depth: number; hint: string }[];
  palette: CodingBlockId[];
};
const BASIC_ACTIONS: Record<RobotKind, CodingBlockId> = { fire: 'missile', ice: 'cool', electric: 'shock' };

export function getCodingMission(kind: RobotKind, wave: number): CodingMission {
  const number = Math.min(3, Math.max(1, Math.trunc(wave))) as MissionNumber;
  const action = BASIC_ACTIONS[kind];
  const base = { fire: 'find', ice: 'in-range', electric: 'repeat-two' } as const;
  let blocks: CodingBlockId[];
  let concept: string, description: string, effect: string;
  if (number === 1) {
    blocks = [base[kind], action];
    concept = { fire: '순차 실행', ice: '조건문', electric: '반복문' }[kind];
    description = {
      fire: '목표를 찾고 미사일을 발사해요.',
      ice: '적이 사거리 안에 있다면 냉각 공격을 해요.',
      electric: '전기 충격 발사를 2번 반복해요.',
    }[kind];
    effect = '종류별 최초 1회만 완료하면 같은 종류 전체의 자동 공격이 활성화돼요. 추가 소환한 로봇도 배치하면 바로 공격해요.';
  } else if (number === 2) {
    blocks = kind === 'ice' ? ['not-slowed', 'freeze'] : ['nearby-two', kind === 'fire' ? 'blast' : 'chain'];
    concept = '조건문 · 특수 공격';
    description = {
      fire: '주변 적이 2마리 이상이면 더 넓고 강한 폭발 미사일을 발사해요.',
      ice: '목표가 냉각되지 않았다면 주변 적까지 급속 냉각해요.',
      electric: '주변 적이 2마리 이상이면 최대 2마리에 강화 전기를 연쇄해요.',
    }[kind];
    effect = {
      fire: '피해 1.35배 · 폭발 반경 2.4칸 · 화상 강화',
      ice: '피해 1.15배 · 주변 2.4칸을 3초간 속도 35%로 냉각',
      electric: '2회 발사 유지 · 연쇄 대상 최대 2마리 · 연쇄 피해 75%',
    }[kind] + '. 조건이 맞지 않으면 기본 공격을 해요.';
  } else {
    const variable = kind === 'fire' ? 'target-health' : 'enemy-count';
    const condition = kind === 'fire' ? 'health-high' : kind === 'ice' ? 'count-three' : 'count-two';
    const special = kind === 'fire' ? 'heavy' : kind === 'ice' ? 'blizzard' : 'overload';
    blocks = [variable, condition, special, 'else', action];
    concept = '변수 + 조건 분기';
    description = {
      fire: '목표체력이 100 이상이면 고위력 미사일, 아니라면 기본 미사일을 발사해요.',
      ice: '적의수가 3 이상이면 냉각 폭풍, 아니라면 기본 냉각 공격을 해요.',
      electric: '적의수가 2 이상이면 3연속 광역 충격, 아니라면 기본 전기 충격을 2번 발사해요.',
    }[kind];
    effect = {
      fire: '고위력 미사일 피해 2배 · 보스도 목표로 찾아요',
      ice: '사거리 전체 피해 1.4배 · 4초간 속도 25%로 냉각',
      electric: '3회 발사 · 피해 1.25배 · 사거리 안의 모든 적에게 75% 연쇄 피해',
    }[kind] + '. 변수는 공격할 때마다 갱신해요. 이 전략이 기존 강화 전략을 대신해요.';
  }
  return {
    number, autoRun: false, concept, description, effect,
    slots: blocks.map((block, index) => ({
      block, depth: number === 3 ? (index === 2 || index === 4 ? 1 : 0) : index === 1 && (kind !== 'fire' || number === 2) ? 1 : 0,
      hint: CODING_BLOCKS[block].label,
    })),
    palette: [...blocks.filter(block => CODING_BLOCKS[block].category === 'action'), ...blocks.filter(block => CODING_BLOCKS[block].category !== 'action')],
  };
}

export function createRobotProgram(kind: RobotKind): RobotProgram {
  const progress = (number: MissionNumber): MissionProgress => ({
    code: getCodingMission(kind, number).slots.map(() => null), status: 'waiting',
    message: number === 1 ? '블록을 연결하고 코드 실행을 눌러 같은 종류 전체의 공격을 활성화하세요.' : '기본 공격은 계속돼요. 강화 블록을 연결하고 코드 실행을 눌러 주세요.',
  });
  return { 1: progress(1), 2: progress(2), 3: progress(3) };
}

export function isCodingBlock(value: string): value is CodingBlockId { return Object.hasOwn(CODING_BLOCKS, value); }
export function validateRobotCode(kind: RobotKind, wave: number, code: readonly (CodingBlockId | null)[]): { success: boolean; message: string } {
  const mission = getCodingMission(kind, wave);
  if (code.length !== mission.slots.length || code.some(block => block === null)) return { success: false, message: '빈칸이 있어요. 모든 칸에 명령어 블록을 넣어 주세요.' };
  const wrong = mission.slots.findIndex((slot, index) => code[index] !== slot.block);
  if (wrong !== -1) return { success: false, message: (wrong + 1) + '번째 블록을 확인해 주세요. ' + mission.slots[wrong].hint + '.' };
  return { success: true, message: mission.number === 1 ? '기본 미션 성공! 같은 종류 전체의 자동 공격이 활성화됐어요.' : '강화 성공! 같은 종류 전체에 특수 공격 전략을 적용했어요.' };
}

export type AttackProfile = {
  shots: number; damage: number; splash: number; burn: number;
  slowDuration: number; slowFactor: number; chainTargets: number; chainDamage: number; area: boolean;
};
// Evaluate the completed blocks against a fresh combat snapshot. Unmet conditions
// and the explicit else branch fall back to the learned basic program.
export function evaluateRobotAttack(kind: RobotKind, program: RobotProgram, context: { count: number; targetHealth: number; targetSlowed: boolean }): AttackProfile {
  const basic = program[1].code;
  const attack: AttackProfile = {
    shots: basic.includes('repeat-two') ? 2 : 1, damage: 1,
    splash: kind === 'fire' ? 1.6 : 0, burn: kind === 'fire' ? 0.2 : 0,
    slowDuration: kind === 'ice' ? 1.4 : 0, slowFactor: 0.6,
    chainTargets: kind === 'electric' ? 1 : 0, chainDamage: 0.5, area: false,
  };
  const upgrade = program[3].status === 'completed' ? program[3] : program[2].status === 'completed' ? program[2] : null;
  if (!upgrade) return attack;
  const code = upgrade.code;
  const count = code.includes('enemy-count') ? context.count : 0;
  const health = code.includes('target-health') ? context.targetHealth : 0;
  const condition = code.includes('nearby-two') ? context.count >= 2
    : code.includes('not-slowed') ? !context.targetSlowed
    : code.includes('health-high') ? health >= 100
    : code.includes('count-three') ? count >= 3 : code.includes('count-two') && count >= 2;
  if (!condition) return attack;
  if (code.includes('blast')) Object.assign(attack, { damage: 1.35, splash: 2.4, burn: 0.3 });
  if (code.includes('freeze')) Object.assign(attack, { damage: 1.15, splash: 2.4, slowDuration: 3, slowFactor: 0.35 });
  if (code.includes('chain')) Object.assign(attack, { chainTargets: 2, chainDamage: 0.75 });
  if (code.includes('heavy')) attack.damage = 2;
  if (code.includes('blizzard')) Object.assign(attack, { damage: 1.4, area: true, slowDuration: 4, slowFactor: 0.25 });
  if (code.includes('overload')) Object.assign(attack, { shots: 3, damage: 1.25, chainTargets: Infinity, chainDamage: 0.75 });
  return attack;
}

import type { CodingBlockId, RobotCode, MissionNumber } from './coding-missions.ts';
export type TilePosition = { x: number; y: number };
export type RobotKind = 'fire' | 'ice' | 'electric';
export type ElementEnergy = Record<RobotKind, number>;
export type CodeBlock = 'find' | 'attack' | 'wait';
export type GameMode = 'move' | 'relocate';
export type GameStatus = 'ready' | 'running' | 'paused' | 'cleared' | 'defeat';
export type RobotState = TilePosition & {
  id: number; kind: RobotKind; grade: number; damage: number; deployed: boolean;
  activeBlock: CodeBlock; attacks: number; targetId: number | null;
  serial: number; code: RobotCode; missionStatus: 'waiting' | 'error' | 'completed'; missionMessage: string;
  missionNumber: MissionNumber; missionVariant: number; deploymentOrder: number; autoAttackActive: boolean; completedMissions: MissionNumber[];
};
export type DefenseState = {
  status: GameStatus; wave: number; health: number; credits: number; kills: number;
  enemies: number; spawned: number; total: number; escaped: number; elapsed: number;
  robots: RobotState[]; robotCount: number; storedRobotCount: number; elementEnergy: ElementEnergy; selectedId: number | null; player: TilePosition;
  mode: GameMode; grid: boolean; message: string; countdown: number;
  monsterSummonCountdown: number | null;
  defeatAnimationComplete: boolean;
  victoryAnimationComplete: boolean;
};
export type GameController = {
  setInteractionLocked: (locked: boolean) => void;
  setMode: (mode: GameMode) => void;
  summon: (kind: RobotKind) => void;
  deployRobot: (id: number) => boolean;
  deployRobotKind: (kind: RobotKind) => boolean;
  selectRobot: (id: number) => void;
  updateCode: (id: number, slot: number, block: CodingBlockId | null, sourceSlot?: number) => void;
  runCode: (id: number) => void;
  merge: () => void;
  toggleGrid: () => void;
  startWave: () => void;
  togglePause: () => void;
  reset: () => void;
  destroy: () => void;
};
export type GameOptions = {
  parent: HTMLElement;
  assetBase?: string;
  onState?: (state: DefenseState) => void;
  onError?: (message: string) => void;
  onInspect?: (id: number) => void;
};

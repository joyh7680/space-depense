export type TilePosition = { x: number; y: number };
export type RobotKind = 'fire' | 'ice' | 'electric';
export type CodeBlock = 'find' | 'attack' | 'wait';
export type GameMode = 'move' | 'relocate';
export type GameStatus = 'ready' | 'running' | 'paused' | 'cleared' | 'defeat';
export type RobotState = TilePosition & {
  id: number; kind: RobotKind; grade: number; range: number; damage: number;
  activeBlock: CodeBlock; attacks: number; targetId: number | null;
};
export type DefenseState = {
  status: GameStatus; wave: number; health: number; credits: number; kills: number;
  enemies: number; spawned: number; total: number; escaped: number; elapsed: number;
  robots: RobotState[]; selectedId: number | null; player: TilePosition;
  mode: GameMode; grid: boolean; message: string; countdown: number;
};
export type GameController = {
  setInteractionLocked: (locked: boolean) => void;
  setMode: (mode: GameMode) => void;
  summon: () => void;
  selectRobot: (id: number) => void;
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
  onInspect?: () => void;
};

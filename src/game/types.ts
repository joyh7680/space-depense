export type TilePosition = { x: number; y: number };
export type DroneKind = 'fire' | 'ice' | 'electric';
export type CodeBlock = 'find' | 'attack' | 'wait';
export type GameMode = 'move' | 'build';
export type GameStatus = 'ready' | 'running' | 'paused' | 'cleared' | 'defeat';
export type DroneState = TilePosition & {
  id: number; kind: DroneKind; grade: number; range: number; damage: number;
  activeBlock: CodeBlock; attacks: number; targetId: number | null;
};
export type DefenseState = {
  status: GameStatus; wave: number; health: number; credits: number; kills: number;
  enemies: number; spawned: number; total: number; escaped: number; elapsed: number;
  drones: DroneState[]; selectedId: number | null; player: TilePosition;
  mode: GameMode; grid: boolean; message: string;
};
export type GameController = {
  setMode: (mode: GameMode) => void;
  summon: () => void;
  selectDrone: (id: number) => void;
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

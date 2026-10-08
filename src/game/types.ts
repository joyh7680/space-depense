export type TilePosition = { x: number; y: number };
export type GameMode = 'move' | 'build' | 'remove';
export type GameStatus = 'ready' | 'running' | 'paused' | 'cleared' | 'defeat';
export type DefenseState = {
  status: GameStatus;
  wave: number;
  health: number;
  credits: number;
  kills: number;
  enemies: number;
  turrets: number;
  player: TilePosition;
  mode: GameMode;
  grid: boolean;
  message: string;
};
export type GameController = {
  setMode: (mode: GameMode) => void;
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
};

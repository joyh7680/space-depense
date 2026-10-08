import Phaser from 'phaser';
import { DefenseScene } from './defense-scene';
import type { GameController, GameOptions } from './types';

export function createDefenseGame(options: GameOptions): GameController {
  const scene = new DefenseScene(options);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: '#15092e',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: options.parent.clientWidth, height: options.parent.clientHeight },
    scene: [scene],
    input: { keyboard: { capture: [] } },
    render: { antialias: false, roundPixels: true },
    audio: { noAudio: true },
  });
  const observer = new ResizeObserver(() => {
    if (game.isBooted && options.parent.clientWidth && options.parent.clientHeight) {
      game.scale.resize(options.parent.clientWidth, options.parent.clientHeight);
    }
  });
  observer.observe(options.parent);
  const preventScroll = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
  };
  options.parent.addEventListener('keydown', preventScroll);
  return {
    setMode: mode => scene.setMode(mode),
    toggleGrid: () => scene.toggleGrid(),
    startWave: () => scene.startWave(),
    togglePause: () => scene.togglePause(),
    reset: () => scene.reset(),
    destroy: () => {
      observer.disconnect();
      options.parent.removeEventListener('keydown', preventScroll);
      game.destroy(true);
    },
  };
}

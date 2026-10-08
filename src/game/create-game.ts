import Phaser from 'phaser';
import { DefenseScene } from './defense-scene';
import type { GameController, GameOptions } from './types';

export async function createDefenseGame(options: GameOptions): Promise<GameController> {
  const runtime = window as unknown as { Phaser: typeof Phaser; SpinePlugin?: Phaser.Types.Core.PluginObjectItem['plugin'] };
  runtime.Phaser = Phaser;
  if (!runtime.SpinePlugin) await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}plugins/SpinePlugin.min.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Spine runtime could not load'));
    document.head.append(script);
  });
  const scene = new DefenseScene(options);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: '#15092e',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: options.parent.clientWidth, height: options.parent.clientHeight },
    scene: [scene],
    plugins: { scene: [{ key: 'SpinePlugin', plugin: runtime.SpinePlugin!, mapping: 'spine' }] },
    input: { keyboard: false, touch: { capture: true } },
    render: { antialias: false, roundPixels: true },
    audio: { noAudio: true },
  });
  const observer = new ResizeObserver(() => {
    if (game.isBooted && options.parent.clientWidth && options.parent.clientHeight) {
      // RESIZE reads parentSize during refresh; update the bounds first when only
      // the Vue panel layout changes (there is no browser window resize event).
      game.scale.getParentBounds();
      game.scale.refresh();
    }
  });
  observer.observe(options.parent);
  return {
    setInteractionLocked: locked => scene.setInteractionLocked(locked),
    setMode: mode => scene.setMode(mode),
    summon: kind => scene.summon(kind),
    selectRobot: id => scene.selectRobot(id),
    updateCode: (id, slot, block) => scene.updateCode(id, slot, block),
    runCode: id => scene.runCode(id),
    merge: () => scene.merge(),
    toggleGrid: () => scene.toggleGrid(),
    startWave: () => scene.startWave(),
    togglePause: () => scene.togglePause(),
    reset: () => scene.reset(),
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}

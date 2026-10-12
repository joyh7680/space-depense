import Phaser from 'phaser';
import { DefenseScene } from './defense-scene';
import type { GameController, GameOptions } from './types';
import { loadSpineRuntime } from './spine-runtime';

export async function createDefenseGame(options: GameOptions): Promise<GameController> {
  const spinePlugin = await loadSpineRuntime();
  const scene = new DefenseScene(options);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: '#15092e',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: options.parent.clientWidth, height: options.parent.clientHeight },
    scene: [scene],
    plugins: { scene: [{ key: 'SpinePlugin', plugin: spinePlugin, mapping: 'spine' }] },
    input: { keyboard: false, touch: { capture: true } },
    render: { antialias: false, roundPixels: true },
    audio: { noAudio: true },
  });
  const observer = new ResizeObserver(() => {
    if (game.isBooted && options.parent.clientWidth && options.parent.clientHeight) {
      // RESIZE reads parentSize during refresh; update the bounds first when
      // the host changes size without a browser window resize event.
      game.scale.getParentBounds();
      game.scale.refresh();
    }
  });
  observer.observe(options.parent);
  return {
    setInteractionLocked: locked => scene.setInteractionLocked(locked),
    setMode: mode => scene.setMode(mode),
    summon: kind => scene.summon(kind),
    deployRobot: id => scene.deployRobot(id),
    selectRobot: id => scene.selectRobot(id),
    updateCode: (id, slot, block, sourceSlot) => scene.updateCode(id, slot, block, sourceSlot),
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

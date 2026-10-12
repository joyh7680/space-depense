import type Phaser from 'phaser';
import type { Shot } from './defense-simulation';

const center = (value: number) => value * 100 + 50;
const LASER_COLOR = 0xb5fff3;
const LASER_DURATION = 220;

// Player and all robot kinds share the original laser beam and soft outer glow.
export function showLaserAttack(scene: Phaser.Scene, container: Phaser.GameObjects.Container, shot: Shot): void {
  for (const glow of [true, false]) {
    const beam = scene.add.line(0, 0,
      center(shot.from.x), center(shot.from.y) - 25,
      center(shot.to.x), center(shot.to.y) - 20, LASER_COLOR)
      .setOrigin(0)
      .setLineWidth((shot.chain ? 3 : 6) * (glow ? 2.5 : 1))
      .setAlpha(glow ? 0.2 : 1);
    container.add(beam);
    scene.tweens.add({ targets: beam, alpha: 0, duration: LASER_DURATION,
      onComplete: () => beam.destroy() });
  }
}

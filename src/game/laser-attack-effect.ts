import type Phaser from 'phaser';
import { PLAYER_LASER_RADIUS } from './wave-one';
import type { Shot } from './defense-simulation';

const center = (value: number) => value * 100 + 50;
const LASER_COLOR = 0xb5fff3;
const LASER_DURATION = 220;

export function showLaserAttack(scene: Phaser.Scene, container: Phaser.GameObjects.Container, shot: Shot): void {
  const radius = shot.radius ?? PLAYER_LASER_RADIUS;
  const pulse = scene.add.graphics().setPosition(center(shot.from.x), center(shot.from.y));
  pulse.fillStyle(LASER_COLOR, 0.12);
  pulse.fillCircle(0, 0, radius);
  pulse.lineStyle(12, LASER_COLOR, 0.2);
  pulse.strokeCircle(0, 0, radius);
  pulse.lineStyle(3, LASER_COLOR, 0.95);
  pulse.strokeCircle(0, 0, radius);
  container.add(pulse);
  scene.tweens.add({ targets: pulse, alpha: 0, duration: LASER_DURATION,
    onComplete: () => pulse.destroy() });
}

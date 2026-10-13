import type Phaser from 'phaser';
import type { Shot } from './defense-simulation';
import { ROBOTS } from './wave-one';

const center = (value: number) => value * 100 + 50;

// One visual per attack, even when a beam or blast damages several enemies.
export function showRobotAttack(scene: Phaser.Scene, effects: Phaser.GameObjects.Container, shot: Shot): void {
  const config = ROBOTS[shot.kind];
  const duration = (shot.duration ?? config.effectDuration) * 1000;
  const group = scene.add.container(center(shot.from.x), center(shot.from.y) - 25);
  const art = scene.add.graphics();
  group.add(art);
  effects.add(group);
  const dx = (shot.to.x - shot.from.x) * 100, dy = (shot.to.y - shot.from.y) * 100;
  const length = Math.hypot(dx, dy);
  if (shot.kind !== 'fire') group.setRotation(Math.atan2(dy, dx));

  const draw = (progress: number) => {
    art.clear();
    if (shot.kind === 'electric') {
      const flicker = Math.sin(progress * Math.PI * 18);
      art.lineStyle(14, 0x3095ff, 0.22);
      art.lineBetween(0, 0, length, 0);
      art.lineStyle(4, 0x76d8ff, 0.95);
      art.beginPath(); art.moveTo(0, 0);
      for (let point = 1; point <= 10; point++) {
        art.lineTo(length * point / 10, point === 10 ? 0 : Math.sin(point * 2.3 + progress * 40) * 9);
      }
      art.strokePath();
      const boltX = Math.min(1, progress * 4) * length;
      art.fillStyle(0xe5faff, 1); art.fillCircle(boltX, 0, 7);
      for (let spark = 0; spark < 8; spark++) {
        const angle = spark * Math.PI / 4 + progress * 3;
        art.lineStyle(2, 0x63bbff, 0.9);
        art.lineBetween(length + Math.cos(angle) * 7, Math.sin(angle) * 7,
          length + Math.cos(angle) * (18 + flicker * 4), Math.sin(angle) * (18 + flicker * 4));
      }
    } else if (shot.kind === 'ice') {
      const pulse = 1 + Math.sin(progress * Math.PI * 12) * 0.12;
      art.lineStyle(40 * pulse, 0x8fd4ff, 0.12); art.lineBetween(0, 0, length, 0);
      art.lineStyle(14 * pulse, 0x59b7ff, 0.9); art.lineBetween(0, -7, length, -7);
      art.lineStyle(14 * pulse, 0xff983f, 0.9); art.lineBetween(0, 7, length, 7);
      art.lineStyle(3, 0xfff5df, 1); art.lineBetween(0, 0, length, 0);
      for (let spark = 0; spark < 8; spark++) {
        const x = ((spark / 8 + progress * 0.7) % 1) * length;
        art.fillStyle(spark % 2 ? 0xffc56b : 0xc3eeff, 0.8);
        art.fillCircle(x, Math.sin(spark * 2 + progress * 20) * 16, 3);
      }
    } else if (shot.phase === 'charge') {
      const radius = 52 - progress * 30;
      art.fillStyle(0xc17bff, 0.2 + progress * 0.4); art.fillCircle(0, 0, radius);
      art.lineStyle(4, 0xe3a6ff, 0.95); art.strokeCircle(0, 0, radius);
      art.fillStyle(0xffe3ff, 0.95); art.fillCircle(0, 0, 6 + progress * 14);
      for (let spark = 0; spark < 12; spark++) {
        const angle = spark * Math.PI / 6 + progress;
        const gap = (shot.radius ?? config.attackRadius) * (1 - progress);
        art.lineStyle(3, 0xb58aff, 0.8);
        art.lineBetween(Math.cos(angle) * gap, Math.sin(angle) * gap,
          Math.cos(angle) * (gap + 18), Math.sin(angle) * (gap + 18));
      }
    } else {
      const radius = (shot.radius ?? config.attackRadius) * Math.min(1, progress * 4);
      art.fillStyle(0xa859ff, 0.2); art.fillCircle(0, 0, radius);
      art.lineStyle(10 * (1 - progress) + 2, 0xe8a2ff, 0.9); art.strokeCircle(0, 0, radius);
      art.lineStyle(3, 0xffe1ff, 0.85); art.strokeCircle(0, 0, radius * 0.77);
      art.fillStyle(0xffedff, 0.7 * (1 - progress)); art.fillCircle(0, 0, 30 * (1 - progress));
      for (let ray = 0; ray < 20; ray++) {
        const angle = ray * Math.PI / 10;
        art.lineStyle(3, ray % 2 ? 0xec95ff : 0x9785ff, 0.8);
        art.lineBetween(Math.cos(angle) * radius * 0.65, Math.sin(angle) * radius * 0.65,
          Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    }
  };
  draw(0);
  const charging = shot.phase === 'charge';
  if (charging) group.setAlpha(0.3);
  scene.tweens.add({ targets: group, alpha: charging ? 1 : 0, duration,
    onUpdate: () => draw(charging ? (group.alpha - 0.3) / 0.7 : 1 - group.alpha),
    onComplete: () => group.destroy() });
}

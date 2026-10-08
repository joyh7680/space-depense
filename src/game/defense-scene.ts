import Phaser from 'phaser';
import { DefenseSimulation, ROUTE, isRouteTile } from './defense-simulation';
import { Room } from './room/room';
import { isWalkable } from './room/walkable';
import type { SpineActor } from './spine';
import { ROBOT_KINDS, ROBOTS, SUMMONED_MONSTER, WAVE_ONE } from './wave-one';
import type { DefenseState, GameMode, GameOptions, RobotKind, TilePosition } from './types';
import type { CodingBlockId } from './coding-missions';

const center = (value: number) => value * 100 + 50;

export class DefenseScene extends Phaser.Scene {
  simulation = new DefenseSimulation();
  mode: GameMode = 'move';
  showGrid = false;
  private room!: Room;
  private player!: SpineActor;
  private aliens = new Map<number, Phaser.GameObjects.Image | SpineActor>();
  private robotArt = new Map<number, SpineActor>();
  private inspectRange = false;
  private units!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private ranges!: Phaser.GameObjects.Graphics;
  private core!: Phaser.GameObjects.Graphics;
  private stationDamage!: Phaser.GameObjects.Graphics;
  private stationEffects!: Phaser.GameObjects.Container;
  private energyEffects!: Phaser.GameObjects.Container;
  private defeatTimer?: Phaser.Time.TimerEvent;
  private defeatAnimationComplete = false;
  private unitLabels = new Map<number, Phaser.GameObjects.Text>();
  private target: TilePosition | null = null;
  private playerTile = { ...this.simulation.player };
  private notice = '바닥 클릭·터치로 이동 · 로봇 선택 후 빈 바닥에 배치';
  private draggedRobot: number | null = null;
  private dragStart: TilePosition | null = null;
  private publishAt = 0;
  private moveAt = 0;
  private interactionLocked = false;
  private options: GameOptions;

  constructor(options: GameOptions) { super('DefenseScene'); this.options = options; }

  preload(): void {
    const base = this.options.assetBase ?? `${import.meta.env.BASE_URL}games/space/`;
    this.load.image('room-tiles', `${base}SPACE_MAP_TILESET.png`);
    this.load.image('monster-mint', `${import.meta.env.BASE_URL}codmos-assets-monster/759c20f0e742/monster-mint.png`);
    this.load.spine('monster-summoned', `${import.meta.env.BASE_URL}codmos-assets/acef8de87e1f/acef8de87e1f2fe72202365bc0c517f690041bd8ab24a55f592a2b2a3c1df8b5.json`, [`${import.meta.env.BASE_URL}codmos-assets/1bae1e1a9bf8/1bae1e1a9bf8c1ac49b4b6c9a7cfd1d56c0eeaab03fef737bf139078ca66add0.atlas`], true);
    const smokeBase = `${import.meta.env.BASE_URL}codmos-assets/game-over/5e04ca1208c8/`;
    this.load.atlas('station-smoke', `${smokeBase}9ae27227-06b4-432c-95e7-305f10efc0e5.png`, `${smokeBase}smoke-frames.json`);
    this.load.spine('player', `${import.meta.env.BASE_URL}codmos-assets/player/int-front.json`, [`${import.meta.env.BASE_URL}codmos-assets/player/int-front.atlas`], true);
    this.load.on('loaderror', () => this.options.onError?.('방 리소스를 불러오지 못했습니다. 새로고침해 주세요.'));
  }

  create(): void {
    if (!this.textures.exists('room-tiles') || !this.textures.exists('monster-mint')) return;
    this.cameras.main.setBackgroundColor('#15092e');
    this.createStars();
    this.room = new Room(this);
    this.route = this.add.graphics().setDepth(3);
    // Broad connected floor tiles make turns readable without relying on a line.
    for (let y = 3; y <= 7; y++) for (let x = 1; x <= 13; x++) {
      if (!isRouteTile(x, y)) continue;
      this.route.fillStyle(0x5c523f); this.route.fillRect(x * 100, y * 100, 100, 100);
      this.route.fillStyle((x + y) % 2 ? 0xdac695 : 0xe5d2a4);
      this.route.fillRect(x * 100 + 4, y * 100 + 4, 92, 92);
      this.route.lineStyle(2, 0xbba371, 0.7); this.route.strokeRect(x * 100 + 4, y * 100 + 4, 92, 92);
      this.route.fillStyle(0xa68b58, 0.7); this.route.fillCircle(center(x), center(y), 3);
    }
    this.units = this.add.graphics().setDepth(12);
    this.ranges = this.add.graphics().setDepth(4);
    this.hover = this.add.graphics().setDepth(4);
    this.stationDamage = this.add.graphics().setDepth(23);
    this.stationEffects = this.add.container(0, 0).setDepth(24);
    this.energyEffects = this.add.container(0, 0).setDepth(21);
    this.createPlayer();
    this.createCore();
    const start = ROUTE[0];
    this.add.text(center(start.x), center(start.y), 'IN →', { fontFamily: 'sans-serif', fontSize: '22px', color: '#6f5731', fontStyle: 'bold' }).setOrigin(0.5).setDepth(5);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const tile = this.tileAt(pointer);
      if (this.draggedRobot !== null && this.dragStart && (tile.x !== this.dragStart.x || tile.y !== this.dragStart.y)) {
        this.notice = this.simulation.moveRobot(this.draggedRobot, tile.x, tile.y);
        if (this.simulation.robots.some(r => r.id === this.draggedRobot && r.x === tile.x && r.y === tile.y)) this.mode = 'move';
        this.publish();
      }
      this.draggedRobot = null; this.dragStart = null;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateHover(pointer));
    this.game.canvas.addEventListener('pointerleave', this.clearHover);
    this.events.once('shutdown', () => this.game.canvas.removeEventListener('pointerleave', this.clearHover));
    this.scale.on('resize', this.fitRoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitRoom, this));
    this.fitRoom();
    this.simulation.startWave();
    this.options.parent.focus({ preventScroll: true });
    this.publish();
  }

  private clearHover = () => this.hover?.clear();

  private createStars(): void {
    const stars = this.add.graphics().setDepth(-5);
    for (let i = 0; i < 95; i++) {
      const x = (i * 487 + 211) % 2600 - 500;
      const y = (i * 337 + 89) % 2400 - 500;
      stars.fillStyle(0xbdb7ef, 0.13 + (i % 4) * 0.08);
      stars.fillRect(x, y, i % 5 === 0 ? 5 : 3, i % 5 === 0 ? 5 : 3);
    }
  }

  private createPlayer(): void {
    this.player = this.add.spine(center(this.playerTile.x), center(this.playerTile.y) + 30, 'player', 'idle', true).setScale(0.19).setDepth(20);
    this.player.setSkinByName('purple');
    this.player.skeleton.setSlotsToSetupPose();
  }

  private createCore(): void {
    const end = ROUTE[ROUTE.length - 1];
    const x = center(end.x), y = center(end.y);
    this.core = this.add.graphics().setDepth(10);
    this.core.fillStyle(0x76f0e9, 0.14); this.core.fillCircle(x, y, 79);
    this.core.lineStyle(3, 0x77eae1, 0.55); this.core.strokeCircle(x, y, 57);
    this.core.fillStyle(0x286579); this.core.fillRoundedRect(x - 35, y - 34, 70, 68, 14);
    this.core.fillStyle(0xa2fcf0); this.core.fillRoundedRect(x - 23, y - 24, 46, 48, 8);
  }

  private destroyStation(): void {
    this.target = null; this.tweens.killTweensOf(this.player); this.player.play('idle', true);
    this.draggedRobot = null; this.dragStart = null; this.clearHover();
    const end = ROUTE[ROUTE.length - 1];
    const x = center(end.x), y = center(end.y);
    this.core.setAlpha(0.15);
    this.cameras.main.shake(1900, 0.014);
    this.cameras.main.flash(350, 255, 120, 60);
    this.stationDamage.fillStyle(0x220d17, 0.45);
    this.stationDamage.setAlpha(0);
    this.tweens.add({ targets: this.stationDamage, alpha: 1, duration: 700 });
    this.stationDamage.fillRect(100, 300, 1400, 600);
    this.stationDamage.fillStyle(0x130d18, 0.85); this.stationDamage.fillCircle(x, y, 85);
    for (const [dx, dy] of [[-160, -200], [340, -250], [700, -180], [870, 120], [300, 190], [-180, 130]]) {
      this.stationDamage.lineStyle(12, 0x150912);
      this.stationDamage.beginPath(); this.stationDamage.moveTo(x, y);
      this.stationDamage.lineTo(x + dx * 0.35 + 35, y + dy * 0.35);
      this.stationDamage.lineTo(x + dx * 0.65 - 25, y + dy * 0.65);
      this.stationDamage.lineTo(x + dx, y + dy); this.stationDamage.strokePath();
      this.stationDamage.lineStyle(3, 0xf27649, 0.8); this.stationDamage.strokePath();
    }
    for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI * 2 / 18;
      const fragment = this.add.rectangle(x, y, 18 + i % 3 * 10, 16, i % 2 ? 0xffb862 : 0x879aab).setDepth(24);
      this.stationEffects.add(fragment);
      this.tweens.add({ targets: fragment, x: x + Math.cos(angle) * (150 + i * 25), y: y + Math.sin(angle) * 180, angle: i * 70, alpha: 0, duration: 1100, onComplete: () => fragment.destroy() });
    }
    const blast = this.add.circle(x, y, 30, 0xffa24b, 0.9).setDepth(24);
    this.stationEffects.add(blast);
    this.tweens.add({ targets: blast, scale: 7, alpha: 0, duration: 800, onComplete: () => blast.destroy() });
    // First burst at the breached base, then dust spreads across the room.
    // Frames preserve the rotations from the supplied Spine atlas.
    for (let i = 0; i < 30; i++) {
      const atBase = i < 10;
      const originX = atBase ? x + (i % 5 - 2) * 26 : 250 + ((i - 10) % 7) * 180;
      const originY = atBase ? y + (i % 3 - 1) * 24 : 370 + Math.floor((i - 10) / 7) * 170;
      const size = atBase ? 125 + i % 3 * 45 : 150 + i % 4 * 30;
      const smoke = this.add.image(originX, originY, 'station-smoke', `smoke0${i % 6 + 1}`)
        .setAlpha(0).setAngle(i * 47);
      smoke.setScale(size / smoke.width);
      this.stationEffects.add(smoke);
      const scaleX = smoke.scaleX, scaleY = smoke.scaleY;
      const delay = atBase ? i * 35 : 300 + (i - 10) * 35;
      this.tweens.add({ targets: smoke, alpha: { from: 0, to: 0.9 }, duration: 180, delay });
      this.tweens.add({
        targets: smoke, x: originX + (i % 2 ? 65 : -65), y: originY - 100 - i % 3 * 30,
        scaleX: scaleX * 2.2, scaleY: scaleY * 2.2, angle: smoke.angle + (i % 2 ? 35 : -35),
        duration: 1200, delay, ease: 'Sine.Out',
      });
      this.tweens.add({ targets: smoke, alpha: 0, duration: 550, delay: delay + 650, onComplete: () => smoke.destroy() });
    }
    // Use scene time so the result follows the actual animation, including tab suspension.
    this.defeatTimer = this.time.delayedCall(2400, () => {
      this.defeatTimer = undefined;
      this.defeatAnimationComplete = true;
      this.publish();
    });
    this.publish();
  }

  private fitRoom(): void {
    const { width, height } = this.scale;
    const side = width > 760 ? 90 : 24;
    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(Math.max(0.06, Math.min((width - side - 24) / 1600, (height - (height < 430 ? 100 : 200)) / 1130)));
    this.cameras.main.centerOn(800, 620);
  }

  private tileAt(pointer: Phaser.Input.Pointer): TilePosition {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(world.x / 100), y: Math.floor(world.y / 100) };
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    this.options.parent.focus({ preventScroll: true });
    if (this.interactionLocked || ['paused', 'defeat', 'cleared'].includes(this.simulation.status)) return;
    const tile = this.tileAt(pointer);
    if (this.simulation.deployedRobots.some(d => d.x === tile.x && d.y === tile.y)) {
      const robot = this.simulation.deployedRobots.find(d => d.x === tile.x && d.y === tile.y)!;
      this.selectRobot(robot.id);
      this.draggedRobot = robot.id; this.dragStart = tile;
    } else if (this.mode === 'relocate' && this.simulation.selectedId !== null) {
      this.notice = this.simulation.moveRobot(this.simulation.selectedId, tile.x, tile.y);
      const moved = this.simulation.robots.find(r => r.id === this.simulation.selectedId);
      if (moved?.x === tile.x && moved.y === tile.y) this.mode = 'move';
    } else if (this.canMove(tile.x, tile.y)) this.target = tile;
    else this.notice = '괴물 길에는 들어갈 수 없어요. 길 밖의 빈 바닥을 선택해 주세요.';
    this.publish();
  }

  private updateHover(pointer: Phaser.Input.Pointer): void {
    this.hover.clear();
    if (this.interactionLocked || ['paused', 'defeat', 'cleared'].includes(this.simulation.status)) return;
    const tile = this.tileAt(pointer);
    if (!isWalkable(tile.x, tile.y)) return;
    this.hover.lineStyle(3, isRouteTile(tile.x, tile.y) ? 0xff7070 : this.mode === 'relocate' ? 0xf3bd6f : 0x89e4dd, 0.85);
    this.hover.strokeRect(tile.x * 100 + 5, tile.y * 100 + 5, 90, 90);
  }

  private canMove(x: number, y: number): boolean {
    return this.simulation.canMovePlayer(x, y);
  }

  update(time: number, delta: number): void {
    if (!this.room) return;
    const previousHealth = this.simulation.health;
    const previousEnergy = { ...this.simulation.elementEnergy };
    const previousRobots = new Set(this.simulation.robots.map(robot => robot.id));
    const previousBosses = new Set(this.simulation.enemies.filter(enemy => enemy.kind === 'summoned').map(enemy => enemy.id));
    const shots = this.simulation.step(delta / 1000);
    if (this.simulation.enemies.some(enemy => enemy.kind === 'summoned' && !previousBosses.has(enemy.id))) this.notice = '보스급 몬스터 출현! 로봇을 배치해서 막아 주세요.';
    if (previousHealth > 0 && this.simulation.status === 'defeat') this.destroyStation();
    if (!['paused', 'defeat', 'cleared'].includes(this.simulation.status)) this.movePlayer(time);
    this.room.updateWall(Math.max(this.playerTile.y, ...this.simulation.deployedRobots.map(r => r.y)));
    this.drawUnits();
    let rewardIndex = 0;
    for (const kind of ROBOT_KINDS) {
      const amount = this.simulation.elementEnergy[kind] - previousEnergy[kind];
      if (amount > 0) this.showEnergyReward(kind, amount, rewardIndex++);
    }
    for (const robot of this.simulation.robots) {
      if (!previousRobots.has(robot.id)) {
        this.notice = `${ROBOTS[robot.kind].name} 획득! 로봇 소환 버튼에서 확인하세요.`;
      }
    }
    for (const shot of shots) {
      const beam = this.add.line(0, 0, center(shot.from.x), center(shot.from.y) - 25, center(shot.to.x), center(shot.to.y) - 20, shot.player ? 0xb5fff3 : ROBOTS[shot.kind].color).setOrigin(0).setLineWidth(shot.chain ? 3 : 6).setDepth(15);
      this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
      const hit = this.add.circle(center(shot.to.x), center(shot.to.y) - 20, 25, ROBOTS[shot.kind].color, 0.8).setDepth(16);
      this.tweens.add({ targets: hit, alpha: 0, scale: 1.8, duration: 240, onComplete: () => hit.destroy() });
    }
    if (time >= this.publishAt) { this.publish(); this.publishAt = time + 120; }
  }

  private showEnergyReward(kind: RobotKind, amount: number, index: number): void {
    const config = ROBOTS[kind];
    const color = `#${config.color.toString(16).padStart(6, '0')}`;
    const label = this.add.text(this.player.x, this.player.y - 95 - index * 34,
      `${config.symbol} ${config.energyName} 에너지 +${amount}`, {
        fontFamily: 'sans-serif', fontSize: '24px', fontStyle: 'bold', color,
        backgroundColor: '#172333', padding: { x: 10, y: 5 },
      }).setOrigin(0.5);
    this.energyEffects.add(label);
    this.tweens.add({ targets: label, y: label.y - 55, alpha: 0, duration: 1100,
      ease: 'Sine.Out', onComplete: () => label.destroy() });
    const glow = this.add.circle(this.player.x, this.player.y - 35, 35)
      .setStrokeStyle(4, config.color, 0.9);
    this.energyEffects.add(glow);
    this.tweens.add({ targets: glow, scale: 1.8, alpha: 0, duration: 550,
      onComplete: () => glow.destroy() });
  }

  private movePlayer(time: number): void {
    if (time < this.moveAt || !this.target) return;
    const next = this.simulation.nextPlayerStep(this.target);
    if (!next) { this.target = null; return; }
    this.playerTile = next;
    this.simulation.player = { ...next };
    this.moveAt = time + 160;
    this.player.play('move', true, true);
    this.tweens.add({ targets: this.player, x: center(next.x), y: center(next.y) + 30, duration: 145, onComplete: () => this.player.play('idle', true) });
    this.room.updateWall(Math.max(next.y, ...this.simulation.deployedRobots.map(r => r.y)));
  }

  private drawUnits(): void {
    this.units.clear();
    this.ranges.clear();
    const s = this.simulation;
    const deployedRobots = s.deployedRobots;
    for (const robot of deployedRobots) {
      const x = center(robot.x), y = center(robot.y), color = ROBOTS[robot.kind].color;
      if (this.inspectRange && robot.id === s.selectedId) {
        this.ranges.fillStyle(color, 0.06); this.ranges.fillCircle(x, y, robot.range * 100);
        this.ranges.lineStyle(2, color, 0.4); this.ranges.strokeCircle(x, y, robot.range * 100);
        this.units.lineStyle(4, color, 1); this.units.strokeEllipse(x, y + 12, 88, 40);
        const target = s.enemies.find(e => e.id === robot.targetId);
        if (target) { this.units.lineStyle(3, color, 0.85); this.units.strokeCircle(center(target.x), center(target.y) - 25, 45); }
      }
      this.units.fillStyle(0x0a1b28, 0.4); this.units.fillEllipse(x, y + 12, 70, 24);
      this.units.lineStyle(3, color, 0.8); this.units.strokeEllipse(x, y + 8, 66, 23);
      this.units.fillStyle(color, 0.2); this.units.fillTriangle(x - 18, y - 3, x + 18, y - 3, x, y + 20);
      let art = this.robotArt.get(robot.id);
      if (!art) {
        art = this.add.spine(x, y + 24, 'player', 'idle', true).setScale(0.17).setDepth(14);
        art.setSkinByName({ fire: 'volta', ice: 'cloud', electric: 'monitorhead' }[robot.kind]);
        art.skeleton.setSlotsToSetupPose();
        this.robotArt.set(robot.id, art);
      }
      art.setPosition(x, y + 24);
      let label = this.unitLabels.get(robot.id);
      if (!label) {
        label = this.add.text(x, y + 38, '', { fontFamily: 'sans-serif', fontSize: '22px', color: '#e7f9f5', backgroundColor: '#1b2638', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(17);
        this.unitLabels.set(robot.id, label);
      }
      const attackEnabled = robot.missionStatus === 'completed';
      art.setAlpha(attackEnabled ? 1 : 0.55);
      label.setVisible(attackEnabled).setPosition(x, y + 38).setText(`${ROBOTS[robot.kind].name} #${robot.serial}\n공격 중`);
    }
    for (const [id, label] of this.unitLabels) { if (!deployedRobots.some(d => d.id === id)) { label.destroy(); this.unitLabels.delete(id); } }
    for (const [id, art] of this.robotArt) if (!deployedRobots.some(d => d.id === id)) { art.destroy(); this.robotArt.delete(id); }
    for (const enemy of s.enemies) {
      const x = center(enemy.x); const y = center(enemy.y);
      this.units.fillStyle(0x112331, 0.35); this.units.fillEllipse(x, y + 12, 65, 24);
      let actor = this.aliens.get(enemy.id);
      if (!actor) {
        actor = enemy.kind === 'summoned'
          ? this.add.spine(x, y + 12, 'monster-summoned', 'idle', true).setDepth(13)
          : this.add.image(x, y - 22, 'monster-mint').setDisplaySize(78, 78).setDepth(13);
        if (enemy.kind === 'summoned') {
          const spine = actor as SpineActor;
          // Invisible effect attachments otherwise inflate Spine's bounds and shrink the body.
          for (const slot of ['attacked', 'die01', 'die02', 'explosion', 'eyes_die', 'eyes_stun', 'magic', 'spawn', 'stun01', 'stun02', 'stun03']) {
            spine.setAttachment(slot, null);
          }
          spine.updateSize();
        }
        this.aliens.set(enemy.id, actor);
      }
      if (enemy.kind === 'summoned') {
        const spine = actor as SpineActor;
        const scale = SUMMONED_MONSTER.size / Math.max(spine.width, spine.height);
        const direction = enemy.waypoint === 3 ? -1 : 1;
        spine.setScale(scale * direction, scale);
        spine.setPosition(x + (spine.displayOriginX - spine.width / 2) * scale * direction,
          y + 12 + (spine.displayOriginY - spine.height) * scale);
      } else {
        (actor as Phaser.GameObjects.Image).setPosition(x, y - 22 + Math.sin(this.time.now / 160 + enemy.id) * 3).setFlipX(enemy.waypoint === 3);
      }
      const healthY = y - (enemy.kind === 'summoned' ? SUMMONED_MONSTER.size + 10 : 85);
      const maxHealth = enemy.kind === 'summoned' ? SUMMONED_MONSTER.health : WAVE_ONE.health;
      const healthWidth = enemy.kind === 'summoned' ? 84 : 56;
      this.units.fillStyle(0x162c36); this.units.fillRoundedRect(x - healthWidth / 2, healthY, healthWidth, 7, 3);
      this.units.fillStyle(enemy.burnTime > 0 ? 0xffac70 : enemy.kind === 'summoned' ? 0xff6969 : 0xe79bce); this.units.fillRoundedRect(x - healthWidth / 2, healthY, healthWidth * Math.max(0, enemy.health / maxHealth), 7, 3);
    }
    for (const [id, actor] of this.aliens) if (!s.enemies.some(e => e.id === id)) {
      this.aliens.delete(id);
      this.tweens.add({ targets: actor, alpha: 0, scale: 0, duration: 200, onComplete: () => actor.destroy() });
    }
  }

  setInteractionLocked(locked: boolean): void { this.interactionLocked = locked; this.clearHover(); }
  setMode(mode: GameMode): void {
    this.mode = mode; this.target = null;
    this.notice = mode === 'relocate' ? '선택한 로봇을 빈 바닥에 배치해 주세요.' : '바닥 클릭·터치로 이동 · 로봇 선택 후 빈 바닥에 배치';
    this.publish();
  }
  toggleGrid(): void { this.showGrid = !this.showGrid; this.room.grid.setVisible(this.showGrid); this.publish(); }
  startWave(): void {
    this.inspectRange = false;
    if (this.simulation.startWave()) { this.mode = 'move'; this.notice = '일반 외계인 12마리가 다가와요! 전투 중에도 소환·합성이 가능해요.'; }
    else this.notice = '전투가 진행 중이에요.';
    this.publish();
  }
  summon(kind: RobotKind): void {
    this.target = null; this.inspectRange = true; this.notice = this.simulation.summon(kind);
    this.mode = 'relocate'; this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  selectRobot(id: number): void {
    this.simulation.selectRobot(id);
    const deployed = this.simulation.deployedRobots.some(robot => robot.id === id);
    this.inspectRange = deployed; this.mode = deployed ? 'relocate' : 'move'; this.target = null;
    this.notice = deployed ? '빈 바닥을 누르거나 로봇을 드래그해서 배치하세요.' : '코딩 미션을 완료하면 로봇이 방에 배치돼요.';
    this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  updateCode(id: number, slot: number, block: CodingBlockId | null): void {
    this.simulation.updateCode(id, slot, block); this.publish();
  }
  runCode(id: number): void { this.notice = this.simulation.runCode(id); this.publish(); }
  merge(): void { this.notice = this.simulation.merge(); this.publish(); }
  togglePause(): void { this.simulation.togglePause(); this.publish(); }
  reset(): void {
    this.defeatTimer?.remove(); this.defeatTimer = undefined;
    for (const effect of this.energyEffects.getAll()) this.tweens.killTweensOf(effect);
    this.energyEffects.removeAll(true);
    this.defeatAnimationComplete = false;
    for (const effect of this.stationEffects.getAll()) this.tweens.killTweensOf(effect);
    this.stationEffects.removeAll(true);
    this.tweens.killTweensOf(this.stationDamage);
    for (const actor of this.aliens.values()) actor.destroy();
    for (const art of this.robotArt.values()) art.destroy();
    for (const label of this.unitLabels.values()) label.destroy();
    this.aliens.clear(); this.robotArt.clear(); this.unitLabels.clear();
    this.inspectRange = false;
    this.simulation = new DefenseSimulation(); this.mode = 'move'; this.target = null;
    this.simulation.startWave();
    this.tweens.killTweensOf(this.player); this.playerTile = { ...this.simulation.player };
    this.player.setAngle(0);
    this.stationDamage.clear().setAlpha(1); this.core.setAlpha(1);
    this.cameras.main.resetFX();
    this.player.setPosition(center(this.playerTile.x), center(this.playerTile.y) + 30);
    this.room.updateWall(this.playerTile.y);
    this.draggedRobot = null; this.dragStart = null; this.moveAt = 0;
    this.notice = '바닥 클릭·터치로 이동 · 로봇 선택 후 빈 바닥에 배치';
    this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  private publish(): void {
    const s = this.simulation;
    const message = s.status === 'cleared' ? '괴물을 모두 처치했어요!' : s.status === 'defeat' ? '괴물이 우리 기지로 탈출해 우주정거장이 파괴됐어요. 게임 오버!' : this.notice;
    const state: DefenseState = { status: s.status, wave: s.wave, health: s.health, credits: s.credits, kills: s.kills, enemies: s.enemies.length, spawned: s.spawned, total: s.totalEnemies, escaped: s.escaped, elapsed: s.elapsed, countdown: Math.ceil(s.countdown), monsterSummonCountdown: s.monsterSummonCountdown, elementEnergy: { ...s.elementEnergy }, robotCount: s.robotCount, robots: s.robots.map(({ cooldown, phaseTimer, burstRemaining, ...robot }) => ({ ...robot, code: [...robot.code] })), selectedId: s.selectedId, player: { ...this.playerTile }, mode: this.mode, grid: this.showGrid, message, defeatAnimationComplete: this.defeatAnimationComplete };
    this.options.onState?.(state);
  }
}

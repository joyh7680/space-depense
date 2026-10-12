import Phaser from 'phaser';
import { DefenseSimulation, ROUTE, isRouteTile } from './defense-simulation';
import { Room } from './room/room';
import { isWalkable } from './room/walkable';
import type { SpineActor } from './spine';
import { ELEMENTS, ROBOT_KINDS, ROBOTS, SUMMONED_MONSTER, WAVE_ONE } from './wave-one';
import type { DefenseState, GameMode, GameOptions, RobotKind, TilePosition } from './types';
import { getBasicRobotAttack, type CodingBlockId } from './coding-missions';
import { getRegularMonster, MONSTER_ASSET_PATH, REGULAR_MONSTERS } from './regular-monsters';
import { SPINE_EFFECTS, type SpineEffectKind } from './effects';
import { ROBOT_ART_SCALE, ROBOT_VISUALS, robotAssetUrl } from './robot-visuals';

const center = (value: number) => value * 100 + 50;
const DRAG_NOTICE = '에너지를 모아 로봇 배치 카드에서 원하는 로봇을 소환하세요. 전장 로봇을 클릭하면 미션이 열려요.';
const NOTICE_DURATION_MS = 4000;
type UnitDrag = {
  robotId: number | null;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  position: TilePosition;
  moved: boolean;
};

export class DefenseScene extends Phaser.Scene {
  simulation = new DefenseSimulation();
  mode: GameMode = 'move';
  showGrid = false;
  private room!: Room;
  private player!: SpineActor;
  private aliens = new Map<number, Phaser.GameObjects.Image | SpineActor>();
  private robotArt = new Map<number, Phaser.GameObjects.Image>();
  private robotSpawnTimes = new Map<number, number>();
  private units!: Phaser.GameObjects.Graphics;
  private ranges!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private core!: Phaser.GameObjects.Graphics;
  private stationDamage!: Phaser.GameObjects.Graphics;
  private stationEffects!: Phaser.GameObjects.Container;
  private energyEffects!: Phaser.GameObjects.Container;
  private combatEffects!: Phaser.GameObjects.Container;
  private clearEffects!: Phaser.GameObjects.Container;
  private effectTimers = new Set<Phaser.Time.TimerEvent>();
  private victoryAnimationComplete = false;
  private defeatTimer?: Phaser.Time.TimerEvent;
  private defeatAnimationComplete = false;
  private unitLabels = new Map<number, Phaser.GameObjects.Text>();
  private playerTile = { ...this.simulation.player };
  private noticeText = DRAG_NOTICE;
  private noticeExpiresAt = 0;
  private get notice(): string {
    return performance.now() < this.noticeExpiresAt ? this.noticeText : '';
  }
  private set notice(message: string) {
    this.noticeText = message;
    this.noticeExpiresAt = performance.now() + NOTICE_DURATION_MS;
  }
  private unitDrag: UnitDrag | null = null;
  private publishAt = 0;
  private interactionLocked = false;
  private options: GameOptions;

  constructor(options: GameOptions) { super('DefenseScene'); this.options = options; }

  preload(): void {
    const base = this.options.assetBase ?? `${import.meta.env.BASE_URL}games/space/`;
    this.load.image('room-tiles', `${base}SPACE_MAP_TILESET.png`);
    for (const kind of ROBOT_KINDS) {
      this.load.svg(ROBOT_VISUALS[kind].texture, robotAssetUrl(kind));
    }
    for (const monster of REGULAR_MONSTERS) {
      this.load.image(monster.texture, `${import.meta.env.BASE_URL}${MONSTER_ASSET_PATH}${monster.file}`);
    }
    this.load.spine('monster-summoned', `${import.meta.env.BASE_URL}codmos-assets/acef8de87e1f/acef8de87e1f2fe72202365bc0c517f690041bd8ab24a55f592a2b2a3c1df8b5.json`, [`${import.meta.env.BASE_URL}codmos-assets/monster/1bae1e1a9bf8/1bae1e1a9bf8c1ac49b4b6c9a7cfd1d56c0eeaab03fef737bf139078ca66add0.atlas`], true);
    const smokeBase = `${import.meta.env.BASE_URL}codmos-assets/game-over/5e04ca1208c8/`;
    this.load.atlas('station-smoke', `${smokeBase}9ae27227-06b4-432c-95e7-305f10efc0e5.png`, `${smokeBase}smoke-frames.json`);
    const effectBase = `${import.meta.env.BASE_URL}codmos-assets/effect/`;
    for (const [key, effect] of Object.entries(SPINE_EFFECTS)) {
      this.load.spine(key, `${effectBase}${effect.json}`, [`${effectBase}${effect.atlas}`], true);
    }
    this.load.spine('player', `${import.meta.env.BASE_URL}codmos-assets/player/int-front.json`, [`${import.meta.env.BASE_URL}codmos-assets/player/int-front.atlas`], true);
    this.load.on('loaderror', () => this.options.onError?.('방 리소스를 불러오지 못했습니다. 새로고침해 주세요.'));
  }

  create(): void {
    if (!this.textures.exists('room-tiles') || REGULAR_MONSTERS.some(monster => !this.textures.exists(monster.texture))) return;
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
    this.combatEffects = this.add.container(0, 0).setDepth(22);
    this.clearEffects = this.add.container(0, 0).setDepth(100);
    this.createPlayer();
    this.createCore();
    const start = ROUTE[0];
    this.add.text(center(start.x), center(start.y), 'IN →', { fontFamily: 'sans-serif', fontSize: '22px', color: '#6f5731', fontStyle: 'bold' }).setOrigin(0.5).setDepth(5);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.endDrag(pointer));
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.unitDrag?.pointerId) this.cancelDrag();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateHover(pointer));
    this.game.canvas.addEventListener('pointerleave', this.onCanvasLeave);
    for (const event of ['pointercancel', 'touchcancel']) this.game.canvas.addEventListener(event, this.cancelDrag);
    window.addEventListener('blur', this.cancelDrag);
    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('pointerleave', this.onCanvasLeave);
      for (const event of ['pointercancel', 'touchcancel']) this.game.canvas.removeEventListener(event, this.cancelDrag);
      window.removeEventListener('blur', this.cancelDrag);
    });
    this.scale.on('resize', this.fitRoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitRoom, this));
    this.fitRoom();
    this.options.parent.focus({ preventScroll: true });
    this.publish();
  }

  private clearHover = () => this.hover?.clear();

  private onCanvasLeave = (event: PointerEvent): void => {
    // Touch emits pointerleave when a finger lifts, before Phaser's touchend.
    if (event.pointerType !== 'touch' && (!this.unitDrag || this.unitDrag.pointerId === 0)) this.cancelDrag();
  };

  private cancelDrag = (): void => {
    this.unitDrag = null;
    this.clearHover();
    if (this.game.canvas) this.game.canvas.style.cursor = 'default';
    if (this.player) this.player.setPosition(center(this.playerTile.x), center(this.playerTile.y) + 30).setDepth(20);
    if (this.units) this.drawUnits();
  };

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
    this.player.updateSize();
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
    this.cancelDrag(); this.tweens.killTweensOf(this.player); this.player.play('idle', true);
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

  private unitAt(pointer: Phaser.Input.Pointer): { robotId: number | null; tile: TilePosition } | null {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Hit the visible body, including the head above its floor tile.
    const contains = (actor: SpineActor | Phaser.GameObjects.Image) => {
      const left = actor.x - actor.displayOriginX * actor.scaleX;
      const top = actor.y - actor.displayOriginY * actor.scaleY;
      return world.x >= left && world.x <= left + actor.width * actor.scaleX
        && world.y >= top && world.y <= top + actor.height * actor.scaleY;
    };
    if (contains(this.player)) return { robotId: null, tile: this.playerTile };
    for (const robot of [...this.simulation.deployedRobots].reverse()) {
      const art = this.robotArt.get(robot.id);
      if (art && contains(art)) return { robotId: robot.id, tile: robot };
    }
    return null;
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    this.options.parent.focus({ preventScroll: true });
    if (this.interactionLocked || this.simulation.status !== 'running' || this.unitDrag || !pointer.primaryDown) return;
    const unit = this.unitAt(pointer);
    if (!unit) return;
    if (unit.robotId !== null) this.selectRobot(unit.robotId);
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const position = { x: center(unit.tile.x), y: center(unit.tile.y) };
    this.unitDrag = { robotId: unit.robotId, pointerId: pointer.id, startX: pointer.x, startY: pointer.y,
      offsetX: position.x - world.x, offsetY: position.y - world.y, position, moved: false };
    this.game.canvas.style.cursor = 'grabbing';
    this.publish();
  }

  private updateDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.unitDrag;
    if (!drag || pointer.id !== drag.pointerId) return;
    if (Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) >= 6) drag.moved = true;
    if (!drag.moved) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    drag.position = { x: world.x + drag.offsetX, y: world.y + drag.offsetY };
    if (drag.robotId === null) this.player.setPosition(drag.position.x, drag.position.y + 30).setDepth(110);
    this.drawUnits();
  }

  private endDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.unitDrag;
    if (!drag || pointer.id !== drag.pointerId) return;
    const insideCanvas = pointer.x >= 0 && pointer.y >= 0 && pointer.x < this.scale.width && pointer.y < this.scale.height;
    if (insideCanvas && !pointer.wasCanceled && !this.interactionLocked && this.simulation.status === 'running') {
      this.updateDrag(pointer);
      if (drag.moved) {
        const x = Math.floor(drag.position.x / 100), y = Math.floor(drag.position.y / 100);
        if (drag.robotId === null) {
          if (this.simulation.movePlayer(x, y)) {
            this.playerTile = { ...this.simulation.player };
            this.notice = '캐릭터 배치 완료!';
          } else this.notice = '길 밖의 빈 바닥에 배치해 주세요.';
        } else if (!this.simulation.robots.some(robot => robot.id === drag.robotId && robot.x === x && robot.y === y)) {
          this.notice = this.simulation.moveRobot(drag.robotId, x, y);
        }
        this.mode = 'move';
      } else if (drag.robotId !== null) {
        this.options.onInspect?.(drag.robotId);
      }
    }
    this.cancelDrag();
    this.publish();
  }

  private updateHover(pointer: Phaser.Input.Pointer): void {
    if (this.unitDrag && pointer.id !== this.unitDrag.pointerId) return;
    this.hover.clear();
    if (this.interactionLocked || this.simulation.status !== 'running') return;
    if (!this.unitDrag) {
      this.game.canvas.style.cursor = this.unitAt(pointer) ? 'grab' : 'default';
      return;
    }
    this.updateDrag(pointer);
    if (!this.unitDrag.moved) return;
    const { position, robotId } = this.unitDrag;
    const x = Math.floor(position.x / 100), y = Math.floor(position.y / 100);
    const valid = robotId === null ? this.simulation.canMovePlayer(x, y) : this.simulation.canMoveRobot(robotId, x, y);
    const color = valid ? 0x89e4dd : 0xff7070;
    this.hover.fillStyle(color, 0.2); this.hover.fillRect(x * 100 + 5, y * 100 + 5, 90, 90);
    this.hover.lineStyle(3, color, 0.9); this.hover.strokeRect(x * 100 + 5, y * 100 + 5, 90, 90);
  }

  update(time: number, delta: number): void {
    if (!this.room) return;
    const previousHealth = this.simulation.health;
    const previousStatus = this.simulation.status;
    const previousStored = this.simulation.storedRobotCount;
    const previousBosses = new Set(this.simulation.enemies.filter(enemy => enemy.kind === 'summoned').map(enemy => enemy.id));
    const shots = this.simulation.step(delta / 1000);
    if (previousStatus === 'ready' && this.simulation.status === 'running') this.notice = this.noticeText;
    if (this.simulation.enemies.some(enemy => enemy.kind === 'summoned' && !previousBosses.has(enemy.id))) this.notice = '보스급 몬스터 출현! 로봇을 배치해서 막아 주세요.';
    if (previousHealth > 0 && this.simulation.status === 'defeat') this.destroyStation();
    if (this.simulation.status !== 'running' && this.unitDrag) this.cancelDrag();
    this.room.updateWall(Math.max(this.playerTile.y, ...this.simulation.deployedRobots.map(r => r.y)));
    this.drawUnits();
    let rewardIndex = 0;
    for (const kind of ROBOT_KINDS) {
      const amount = previousStatus === 'running' ? this.simulation.lastEnergyRewards[kind] : 0;
      if (amount > 0) this.showEnergyReward(kind, amount, rewardIndex++);
    }
    if (this.simulation.storedRobotCount > previousStored) this.notice = '로봇을 획득했어요! 로봇 배치 카드에서 선택해 소환하세요.';
    for (const shot of shots) {
      const color = shot.player ? 0xb5fff3 : ROBOTS[shot.kind].color;
      if (!shot.player && !shot.chain && shot.kind !== 'electric') {
        const x = center(shot.to.x), y = center(shot.to.y) - 20;
        const radius = getBasicRobotAttack(shot.kind).splash * 100;
        const pulse = this.add.circle(x, y, radius, color, 0.15).setStrokeStyle(5, color, 0.9).setScale(0.15);
        this.combatEffects.add(pulse);
        this.tweens.add({ targets: pulse, scale: 1, alpha: 0, duration: 350, onComplete: () => pulse.destroy() });
        if (shot.kind === 'ice') {
          const coldPulse = this.add.circle(x, y, radius, 0x88d9ff, 0.08).setStrokeStyle(4, 0x88d9ff, 0.9).setScale(0.1);
          this.combatEffects.add(coldPulse);
          this.tweens.add({ targets: coldPulse, scale: 1, alpha: 0, duration: 450, onComplete: () => coldPulse.destroy() });
        }
      }
      for (const glow of [true, false]) {
        const beam = this.add.line(0, 0, center(shot.from.x), center(shot.from.y) - 25, center(shot.to.x), center(shot.to.y) - 20, color)
          .setOrigin(0).setLineWidth((shot.chain ? 3 : 6) * (glow ? 2.5 : 1)).setAlpha(glow ? 0.2 : 1);
        this.combatEffects.add(beam);
        this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
      }
    }
    if (previousStatus !== 'cleared' && this.simulation.status === 'cleared' && this.simulation.wave === 3) this.showGameClear();
    if (time >= this.publishAt) { this.publish(); this.publishAt = time + 120; }
  }

  private afterEffect(duration: number, callback: () => void): void {
    const timer = this.time.delayedCall(duration, () => {
      this.effectTimers.delete(timer);
      callback();
    });
    this.effectTimers.add(timer);
  }

  private showSpineEffect(kind: SpineEffectKind, x: number, y: number, container = this.combatEffects): void {
    const effect = SPINE_EFFECTS[kind];
    const actor = this.add.spine(x, y, kind, effect.animation, false).setScale(effect.scale);
    container.add(actor);
    this.afterEffect(effect.duration, () => actor.destroy());
  }

  private showGameClear(): void {
    this.cancelDrag();
    this.tweens.killTweensOf(this.player);
    this.player.play('idle', true);
    this.clearHover();
    // Room coordinates keep the title centered and responsive to camera resizing.
    const backdrop = this.add.rectangle(800, 620, 3200, 2400, 0x100b25, 0.65);
    this.clearEffects.add(backdrop);
    this.showSpineEffect('game-clear', 800, 620, this.clearEffects);
    this.afterEffect(SPINE_EFFECTS['game-clear'].duration, () => {
      this.clearEffects.removeAll(true);
      this.victoryAnimationComplete = true;
      this.publish();
    });
    this.publish();
  }

  private showEnergyReward(kind: RobotKind, amount: number, index: number): void {
    const config = ELEMENTS[kind];
    const color = `#${config.color.toString(16).padStart(6, '0')}`;
    const label = this.add.text(this.player.x, this.player.y - 95 - index * 34,
      `${config.symbol} +${amount}`, {
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

  private showRobotSummon(x: number, y: number, color: number): void {
    const ring = this.add.ellipse(x, y + 10, 100, 42, color, 0.22).setStrokeStyle(4, 0xfff2a0, 0.9);
    const beam = this.add.rectangle(x, y - 95, 74, 220, color, 0.35);
    this.combatEffects.add([ring, beam]);
    this.tweens.add({ targets: ring, scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: 700,
      onComplete: () => ring.destroy() });
    this.tweens.add({ targets: beam, scaleX: 0.2, alpha: 0, duration: 550,
      onComplete: () => beam.destroy() });
  }

  private drawUnits(): void {
    this.units.clear();
    this.ranges.clear();
    const s = this.simulation;
    const deployedRobots = s.deployedRobots;
    const labelBounds: { left: number; right: number; top: number; bottom: number }[] = [];
    const labelGap = 4 / this.cameras.main.zoom;
    for (const robot of deployedRobots) {
      const dragging = this.unitDrag?.robotId === robot.id && this.unitDrag.moved;
      const x = dragging ? this.unitDrag!.position.x : center(robot.x);
      const y = dragging ? this.unitDrag!.position.y : center(robot.y), color = ROBOTS[robot.kind].color;
      if (robot.id === s.selectedId) {
        if (robot.kind === 'fire') {
          const radius = ROBOTS.fire.range * 100;
          this.ranges.fillStyle(color, 0.06); this.ranges.fillCircle(x, y, radius);
          this.ranges.lineStyle(2, color, 0.4); this.ranges.strokeCircle(x, y, radius);
        }
        this.units.lineStyle(4, color, 1); this.units.strokeEllipse(x, y + 12, 88, 40);
        const target = s.enemies.find(e => e.id === robot.targetId);
        if (target) { this.units.lineStyle(3, color, 0.85); this.units.strokeCircle(center(target.x), center(target.y) - 25, 45); }
      }
      this.units.fillStyle(0x0a1b28, 0.4); this.units.fillEllipse(x, y + 12, 70, 24);
      this.units.lineStyle(3, color, 0.8); this.units.strokeEllipse(x, y + 8, 66, 23);
      this.units.fillStyle(color, 0.2); this.units.fillTriangle(x - 18, y - 3, x + 18, y - 3, x, y + 20);
      let art = this.robotArt.get(robot.id);
      if (!art) {
        art = this.add.image(x, y + 24, ROBOT_VISUALS[robot.kind].texture)
          .setOrigin(0.5, 1).setScale(ROBOT_ART_SCALE).setDepth(14);
        this.robotArt.set(robot.id, art);
        this.robotSpawnTimes.set(robot.id, s.elapsed);
        this.showRobotSummon(x, y, color);
      }
      art.setPosition(x, y + 24).setDepth(dragging ? 110 : 14);
      let label = this.unitLabels.get(robot.id);
      if (!label) {
        label = this.add.text(x, y + 38, '', { fontFamily: 'sans-serif', fontSize: '22px', align: 'center', color: '#e7f9f5', backgroundColor: '#1b2638', padding: { x: 8, y: 5 } }).setOrigin(0.5, 0).setDepth(102);
        this.unitLabels.set(robot.id, label);
      }
      const attackEnabled = robot.autoAttackActive;
      const arrival = Math.min(1, Math.max(0, (s.elapsed - (this.robotSpawnTimes.get(robot.id) ?? s.elapsed)) / 0.55));
      art.setScale(ROBOT_ART_SCALE * (0.35 + 0.65 * Math.sin(arrival * Math.PI / 2)));
      art.setAlpha((0.4 + arrival * 0.6) * (attackEnabled ? 1 : 0.9));
      if (!attackEnabled && s.status !== 'cleared' && s.status !== 'defeat') {
        const pulse = (Math.sin(s.elapsed * 4 + robot.id) + 1) / 2;
        this.units.lineStyle(3, 0xfff2a0, 0.4 + pulse * 0.5);
        this.units.strokeEllipse(x, y + 10, 84 + pulse * 12, 34 + pulse * 6);
        for (let sparkle = 0; sparkle < 3; sparkle++) {
          const angle = s.elapsed * 1.4 + sparkle * Math.PI * 2 / 3 + robot.id;
          const sx = x + Math.cos(angle) * 57, sy = y - 73 + Math.sin(angle) * 43;
          const size = (5 + pulse * 4) * 1.4;
          this.units.fillStyle(0xfff2a0, 0.6 + pulse * 0.4);
          this.units.fillTriangle(sx, sy - size, sx + size * 0.5, sy, sx, sy + size);
          this.units.fillTriangle(sx, sy - size, sx - size * 0.5, sy, sx, sy + size);
        }
      }
      label.setFontSize(Math.max(18, 11 / this.cameras.main.zoom)).setDepth(dragging ? 111 : 102)
        .setColor(attackEnabled ? '#a4f3d8' : '#ffe39b')
        .setBackgroundColor(attackEnabled ? '#173c38' : '#443522')
        .setText(`${ROBOTS[robot.kind].name} #${robot.serial}\n${attackEnabled ? '공격 중' : '✦ 공격 대기 · 클릭'}`);
      const left = x - label.width / 2, right = x + label.width / 2;
      const overlaps = (top: number) => labelBounds.filter(bounds => left < bounds.right + labelGap
        && right > bounds.left - labelGap && top < bounds.bottom + labelGap && top + label.height > bounds.top - labelGap);
      let labelY = y + 38;
      for (let collisions = overlaps(labelY); collisions.length; collisions = overlaps(labelY)) {
        labelY = Math.max(...collisions.map(bounds => bounds.bottom)) + labelGap;
      }
      // Keep a readable screen size and stagger neighboring labels without hiding them under the HUD.
      if (labelY + label.height > this.cameras.main.worldView.bottom - 120 / this.cameras.main.zoom) {
        labelY = y - 140 - label.height;
        for (let collisions = overlaps(labelY); collisions.length; collisions = overlaps(labelY)) {
          labelY = Math.min(...collisions.map(bounds => bounds.top)) - label.height - labelGap;
        }
      }
      label.setPosition(x, labelY);
      labelBounds.push({ left, right, top: labelY, bottom: labelY + label.height });
      if (labelY !== y + 38) {
        this.units.lineStyle(1.5 / this.cameras.main.zoom, attackEnabled ? 0xa4f3d8 : 0xffe39b, 0.8);
        this.units.lineBetween(x, labelY > y ? y + 28 : y - 110, x, labelY > y ? labelY : labelY + label.height);
      }
    }
    for (const [id, label] of this.unitLabels) { if (!deployedRobots.some(d => d.id === id)) { label.destroy(); this.unitLabels.delete(id); } }
    for (const [id, art] of this.robotArt) if (!deployedRobots.some(d => d.id === id)) { art.destroy(); this.robotArt.delete(id); this.robotSpawnTimes.delete(id); }
    for (const enemy of s.enemies) {
      const x = center(enemy.x); const y = center(enemy.y);
      this.units.fillStyle(0x112331, 0.35); this.units.fillEllipse(x, y + 12, 65, 24);
      let actor = this.aliens.get(enemy.id);
      if (!actor) {
        actor = enemy.kind === 'summoned'
          ? this.add.spine(x, y + 12, 'monster-summoned', 'idle', true).setDepth(13)
          : this.add.image(x, y - 22, getRegularMonster(s.wave).texture).setDisplaySize(78, 78).setDepth(13);
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

  setInteractionLocked(locked: boolean): void { this.interactionLocked = locked; this.cancelDrag(); }
  setMode(mode: GameMode): void {
    this.cancelDrag(); this.mode = mode;
    this.notice = DRAG_NOTICE;
    this.publish();
  }
  toggleGrid(): void { this.showGrid = !this.showGrid; this.room.grid.setVisible(this.showGrid); this.publish(); }
  startWave(): void {
    if (this.simulation.startWave()) { this.mode = 'move'; this.notice = this.simulation.wave > 1 ? '에너지와 로봇이 초기화됐어요. 로봇을 획득하고 이번 웨이브 미션을 완료하세요.' : '로봇마다 이번 웨이브 미션을 완료해 기본 자동 공격을 시작하세요.'; }
    else this.notice = '전투가 진행 중이에요.';
    this.publish();
  }
  summon(kind: RobotKind): void {
    this.cancelDrag(); this.notice = this.simulation.summon(kind);
    this.mode = 'relocate'; this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  deployRobot(id: number): boolean {
    const deployed = this.simulation.deployRobot(id);
    const robot = this.simulation.robots.find(robot => robot.id === id);
    this.notice = deployed && robot
      ? `${ROBOTS[robot.kind].name} #${robot.serial} 배치 완료! 공격 대기 로봇을 클릭해 코딩 미션을 시작하세요.`
      : robot?.missionMessage || '배치할 보관 로봇을 선택해 주세요.';
    if (deployed) { this.cancelDrag(); this.mode = 'relocate'; }
    this.drawUnits(); this.publish();
    return deployed;
  }
  deployRobotKind(kind: RobotKind): boolean {
    const deployed = this.simulation.deployRobotKind(kind);
    this.notice = deployed ? `${ROBOTS[kind].name} 소환 완료! 공격 대기 로봇을 클릭해 코딩 미션을 시작하세요.` : '필요 에너지와 빈 배치 칸을 확인해 주세요.';
    if (deployed) { this.cancelDrag(); this.mode = 'relocate'; }
    this.drawUnits(); this.publish();
    return deployed;
  }
  selectRobot(id: number): void {
    this.simulation.selectRobot(id);
    const deployed = this.simulation.deployedRobots.some(robot => robot.id === id);
    this.mode = deployed ? 'relocate' : 'move';
    const robot = this.simulation.robots.find(robot => robot.id === id);
    this.notice = deployed
      ? robot?.autoAttackActive ? '자동 공격 중이에요. 로봇을 드래그해서 배치하세요.' : '로봇을 드래그해서 배치할 수 있어요. 오른쪽 이번 웨이브 미션을 완료하면 기본 자동 공격을 시작해요.'
      : robot?.missionMessage ?? '로봇 소환 버튼에서 로봇을 선택하세요.';
    this.drawUnits();
    this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  updateCode(id: number, slot: number, block: CodingBlockId | null, sourceSlot?: number): void {
    const completedMission = this.simulation.updateCode(id, slot, block, sourceSlot);
    const robot = this.simulation.robots.find(robot => robot.id === id);
    if (completedMission && robot) {
      this.notice = robot.program[completedMission].message;
      const x = center(robot.x), y = center(robot.y) - 25;
      const text = this.add.text(x, y - 75, '공격 성공!', {
        fontFamily: 'sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#a4f3d8',
        stroke: '#14283a', strokeThickness: 6,
      }).setOrigin(0.5);
      this.energyEffects.add(text);
      this.tweens.add({ targets: text, y: y - 125, alpha: 0, duration: 1400, ease: 'Sine.Out', onComplete: () => text.destroy() });
    }
    this.publish();
  }
  runCode(id: number): void { this.notice = this.simulation.runCode(id); this.publish(); }
  merge(): void { this.notice = this.simulation.merge(); this.publish(); }
  togglePause(): void { this.simulation.togglePause(); this.publish(); }
  reset(): void {
    this.cancelDrag();
    this.defeatTimer?.remove(); this.defeatTimer = undefined;
    for (const timer of this.effectTimers) timer.remove();
    this.effectTimers.clear();
    for (const effect of this.combatEffects.getAll()) this.tweens.killTweensOf(effect);
    this.combatEffects.removeAll(true);
    this.clearEffects.removeAll(true);
    this.victoryAnimationComplete = false;
    for (const effect of this.energyEffects.getAll()) this.tweens.killTweensOf(effect);
    this.energyEffects.removeAll(true);
    this.defeatAnimationComplete = false;
    for (const effect of this.stationEffects.getAll()) this.tweens.killTweensOf(effect);
    this.stationEffects.removeAll(true);
    this.tweens.killTweensOf(this.stationDamage);
    for (const actor of this.aliens.values()) actor.destroy();
    for (const art of this.robotArt.values()) art.destroy();
    for (const label of this.unitLabels.values()) label.destroy();
    this.aliens.clear(); this.robotArt.clear(); this.unitLabels.clear(); this.robotSpawnTimes.clear();
    this.simulation = new DefenseSimulation(); this.mode = 'move';
    this.tweens.killTweensOf(this.player); this.playerTile = { ...this.simulation.player };
    this.player.play('idle', true);
    this.player.setAngle(0);
    this.stationDamage.clear().setAlpha(1); this.core.setAlpha(1);
    this.cameras.main.resetFX();
    this.player.setPosition(center(this.playerTile.x), center(this.playerTile.y) + 30);
    this.room.updateWall(this.playerTile.y);
    this.notice = DRAG_NOTICE;
    this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  private publish(): void {
    const s = this.simulation;
    const message = s.status === 'cleared' ? '괴물을 모두 처치했어요!' : s.status === 'defeat' ? '괴물이 우리 기지로 탈출해 우주정거장이 파괴됐어요. 게임 오버!' : this.notice;
    const state: DefenseState = { status: s.status, wave: s.wave, health: s.health, credits: s.credits, kills: s.kills, enemies: s.enemies.length, spawned: s.spawned, total: s.totalEnemies, escaped: s.escaped, elapsed: s.elapsed, countdown: Math.ceil(Math.max(0, s.countdown - 0.000001)), monsterSummonRemaining: s.monsterSummonRemaining, elementEnergy: { ...s.elementEnergy }, robotCount: s.robotCount, storedRobotCount: s.storedRobotCount, robots: s.robots.map(({ program, cooldown, phaseTimer, burstRemaining, burstProfile, ...robot }) => ({ ...robot, code: [...robot.code], completedMissions: [...robot.completedMissions] })), selectedId: s.selectedId, player: { ...this.playerTile }, mode: this.mode, grid: this.showGrid, message, defeatAnimationComplete: this.defeatAnimationComplete, victoryAnimationComplete: this.victoryAnimationComplete };
    this.options.onState?.(state);
  }
}

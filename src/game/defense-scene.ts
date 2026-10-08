import Phaser from 'phaser';
import { DefenseSimulation, ROUTE } from './defense-simulation';
import { Room } from './room/room';
import { isWalkable } from './room/walkable';
import type { SpineActor } from './spine';
import { DEPLOY_SLOTS, DRONES, SUMMON_COST, WAVE_ONE } from './wave-one';
import type { DefenseState, GameMode, GameOptions, TilePosition } from './types';

const center = (value: number) => value * 100 + 50;

export class DefenseScene extends Phaser.Scene {
  simulation = new DefenseSimulation();
  mode: GameMode = 'move';
  showGrid = false;
  private room!: Room;
  private player!: SpineActor;
  private aliens = new Map<number, SpineActor>();
  private droneArt = new Map<number, Phaser.GameObjects.Image>();
  private inspectRange = false;
  private units!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private ranges!: Phaser.GameObjects.Graphics;
  private unitLabels = new Map<number, Phaser.GameObjects.Text>();
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private target: TilePosition | null = null;
  private playerTile = { x: 11, y: 4 };
  private notice = '랜덤 소환으로 드론 3개를 준비하고 1웨이브를 시작해 보세요.';
  private publishAt = 0;
  private moveAt = 0;
  private options: GameOptions;

  constructor(options: GameOptions) { super('DefenseScene'); this.options = options; }

  preload(): void {
    const base = this.options.assetBase ?? `${import.meta.env.BASE_URL}games/space/`;
    this.load.image('room-tiles', `${base}SPACE_MAP_TILESET.png`);
    this.load.atlas('drone-heads', `${import.meta.env.BASE_URL}codmos-assets/player/int-front.png`, `${import.meta.env.BASE_URL}codmos-assets/player/drone-heads.json`);
    this.load.spine('alien', `${import.meta.env.BASE_URL}codmos-assets/52081da08bde/52081da08bde93ae825e4e531268cd4dd0f33a0bbb05d7f2bba70e96d9c9aba4.json`, [`${import.meta.env.BASE_URL}codmos-assets/1bae1e1a9bf8/1bae1e1a9bf8c1ac49b4b6c9a7cfd1d56c0eeaab03fef737bf139078ca66add0.atlas`], true);
    this.load.spine('slime', `${import.meta.env.BASE_URL}codmos-assets/e5f5d6e48832/e5f5d6e488328c87d1425a4f224f6a092f5e53c4fdd4421447947414656c12c0.json`, [`${import.meta.env.BASE_URL}codmos-assets/aa9ad7124c35/aa9ad7124c353e510a8d0365a30f0d2097ed46ea8f4f1ad89b87b320e9e6c68a.atlas`], true);
    this.load.spine('player', `${import.meta.env.BASE_URL}codmos-assets/player/int-front.json`, [`${import.meta.env.BASE_URL}codmos-assets/player/int-front.atlas`], true);
    this.load.on('loaderror', () => this.options.onError?.('방 리소스를 불러오지 못했습니다. 새로고침해 주세요.'));
  }

  create(): void {
    if (!this.textures.exists('room-tiles') || !this.textures.exists('drone-heads')) return;
    this.cameras.main.setBackgroundColor('#15092e');
    this.createStars();
    this.room = new Room(this);
    this.route = this.add.graphics().setDepth(3);
    this.route.lineStyle(5, 0xf4bd69, 0.55);
    this.route.beginPath();
    this.route.moveTo(center(ROUTE[0].x), center(ROUTE[0].y));
    for (const point of ROUTE.slice(1)) this.route.lineTo(center(point.x), center(point.y));
    this.route.strokePath();
    this.units = this.add.graphics().setDepth(12);
    this.ranges = this.add.graphics().setDepth(4);
    this.hover = this.add.graphics().setDepth(4);
    this.createPlayer();
    this.createCore();
    this.add.text(center(2), center(7) + 65, '외계인 진입 →', { fontFamily: 'sans-serif', fontSize: '25px', color: '#ffd5a0' }).setOrigin(0.5).setDepth(15);
    this.add.text(center(8), center(3) - 95, '우리 기지', { fontFamily: 'sans-serif', fontSize: '25px', color: '#b0fff0' }).setOrigin(0.5).setDepth(15);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as typeof this.wasd;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateHover(pointer));
    this.game.canvas.addEventListener('pointerleave', this.clearHover);
    this.events.once('shutdown', () => this.game.canvas.removeEventListener('pointerleave', this.clearHover));
    this.scale.on('resize', this.fitRoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitRoom, this));
    this.fitRoom();
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
    const core = this.add.graphics().setDepth(10);
    core.fillStyle(0x76f0e9, 0.14); core.fillCircle(center(8), center(3), 79);
    core.lineStyle(3, 0x77eae1, 0.55); core.strokeCircle(center(8), center(3), 57);
    core.fillStyle(0x286579); core.fillRoundedRect(center(8) - 35, center(3) - 34, 70, 68, 14);
    core.fillStyle(0xa2fcf0); core.fillRoundedRect(center(8) - 23, center(3) - 24, 46, 48, 8);
    this.tweens.add({ targets: core, alpha: 0.65, duration: 1500, yoyo: true, repeat: -1 });
  }

  private fitRoom(): void {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Math.min(width / 1660, (height - 130) / 1270));
    this.cameras.main.centerOn(800, 690);
  }

  private tileAt(pointer: Phaser.Input.Pointer): TilePosition {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(world.x / 100), y: Math.floor(world.y / 100) };
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    this.options.parent.focus({ preventScroll: true });
    if (['paused', 'defeat', 'cleared'].includes(this.simulation.status)) return;
    const tile = this.tileAt(pointer);
    if (this.mode === 'build') {
      if (tile.x === this.playerTile.x && tile.y === this.playerTile.y) this.notice = '대원이 있는 자리에는 배치할 수 없습니다.';
      else this.notice = this.simulation.placeDrone(tile.x, tile.y);
    } else if (this.simulation.drones.some(d => d.x === tile.x && d.y === tile.y)) {
      const drone = this.simulation.drones.find(d => d.x === tile.x && d.y === tile.y)!;
      this.selectDrone(drone.id);
    } else if (this.canMove(tile.x, tile.y)) this.target = tile;
    else this.notice = '방 안의 빈 바닥을 선택해 주세요.';
    this.publish();
  }

  private updateHover(pointer: Phaser.Input.Pointer): void {
    this.hover.clear();
    const tile = this.tileAt(pointer);
    if (!isWalkable(tile.x, tile.y)) return;
    this.hover.lineStyle(3, this.mode === 'build' ? 0xf3bd6f : 0x89e4dd, 0.85);
    this.hover.strokeRect(tile.x * 100 + 5, tile.y * 100 + 5, 90, 90);
  }

  private canMove(x: number, y: number): boolean {
    return isWalkable(x, y) && !(x === 8 && y === 3) && !DEPLOY_SLOTS.some(t => t.x === x && t.y === y);
  }

  update(time: number, delta: number): void {
    if (!this.room) return;
    const shots = this.simulation.step(delta / 1000);
    if (!['paused', 'defeat', 'cleared'].includes(this.simulation.status)) this.movePlayer(time);
    this.drawUnits();
    for (const shot of shots) {
      const beam = this.add.line(0, 0, center(shot.from.x), center(shot.from.y) - 25, center(shot.to.x), center(shot.to.y) - 20, DRONES[shot.kind].color).setOrigin(0).setLineWidth(shot.chain ? 3 : 6).setDepth(15);
      this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
      const hit = this.add.circle(center(shot.to.x), center(shot.to.y) - 20, 25, DRONES[shot.kind].color, 0.8).setDepth(16);
      this.tweens.add({ targets: hit, alpha: 0, scale: 1.8, duration: 240, onComplete: () => hit.destroy() });
    }
    if (time >= this.publishAt) { this.publish(); this.publishAt = time + 120; }
  }

  private movePlayer(time: number): void {
    if (time < this.moveAt) return;
    let dx = 0; let dy = 0;
    if (document.activeElement === this.options.parent) {
      if (this.cursors?.left.isDown || this.wasd?.left.isDown) dx = -1;
      else if (this.cursors?.right.isDown || this.wasd?.right.isDown) dx = 1;
      else if (this.cursors?.up.isDown || this.wasd?.up.isDown) dy = -1;
      else if (this.cursors?.down.isDown || this.wasd?.down.isDown) dy = 1;
    }
    if (dx || dy) this.target = null;
    else if (this.target) {
      const step = this.findNextStep(this.target);
      if (!step) { this.target = null; return; }
      dx = step.x - this.playerTile.x; dy = step.y - this.playerTile.y;
    }
    if (!dx && !dy) return;
    const next = { x: this.playerTile.x + dx, y: this.playerTile.y + dy };
    if (!this.canMove(next.x, next.y)) return;
    this.playerTile = next;
    this.moveAt = time + 160;
    this.player.play('move', true, true);
    this.tweens.add({ targets: this.player, x: center(next.x), y: center(next.y) + 30, duration: 145, onComplete: () => this.player.play('idle', true) });
    this.room.updateWall(next.y);
  }

  private findNextStep(target: TilePosition): TilePosition | null {
    const queue: { tile: TilePosition; first: TilePosition | null }[] = [{ tile: this.playerTile, first: null }];
    const visited = new Set([`${this.playerTile.x},${this.playerTile.y}`]);
    for (let index = 0; index < queue.length; index++) {
      const entry = queue[index];
      if (entry.tile.x === target.x && entry.tile.y === target.y) return entry.first;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const next = { x: entry.tile.x + dx, y: entry.tile.y + dy };
        const key = `${next.x},${next.y}`;
        if (visited.has(key) || !this.canMove(next.x, next.y)) continue;
        visited.add(key); queue.push({ tile: next, first: entry.first ?? next });
      }
    }
    return null;
  }

  private drawUnits(): void {
    this.units.clear();
    this.ranges.clear();
    const s = this.simulation;
    for (const slot of DEPLOY_SLOTS) {
      const occupied = s.drones.some(d => d.x === slot.x && d.y === slot.y);
      this.ranges.fillStyle(0x90ffe6, occupied ? 0.08 : 0.12);
      this.ranges.fillRoundedRect(slot.x * 100 + 8, slot.y * 100 + 8, 84, 84, 16);
      this.ranges.lineStyle(this.mode === 'build' ? 4 : 2, 0x8de7d7, occupied ? 0.25 : 0.55);
      this.ranges.strokeRoundedRect(slot.x * 100 + 8, slot.y * 100 + 8, 84, 84, 16);
      if (!occupied) { this.ranges.lineBetween(center(slot.x) - 12, center(slot.y), center(slot.x) + 12, center(slot.y)); this.ranges.lineBetween(center(slot.x), center(slot.y) - 12, center(slot.x), center(slot.y) + 12); }
    }
    for (const drone of s.drones) {
      const x = center(drone.x), y = center(drone.y), color = DRONES[drone.kind].color;
      if (this.inspectRange && drone.id === s.selectedId) {
        this.ranges.fillStyle(color, 0.06); this.ranges.fillCircle(x, y, drone.range * 100);
        this.ranges.lineStyle(2, color, 0.4); this.ranges.strokeCircle(x, y, drone.range * 100);
        this.units.lineStyle(4, color, 1); this.units.strokeEllipse(x, y + 12, 88, 40);
        const target = s.enemies.find(e => e.id === drone.targetId);
        if (target) { this.units.lineStyle(3, color, 0.85); this.units.strokeCircle(center(target.x), center(target.y) - 25, 45); }
      }
      this.units.fillStyle(0x0a1b28, 0.4); this.units.fillEllipse(x, y + 12, 70, 24);
      this.units.lineStyle(3, color, 0.8); this.units.strokeEllipse(x, y + 8, 66, 23);
      this.units.fillStyle(color, 0.2); this.units.fillTriangle(x - 18, y - 3, x + 18, y - 3, x, y + 20);
      let art = this.droneArt.get(drone.id);
      if (!art) {
        art = this.add.image(x, y - 25, 'drone-heads', drone.kind).setScale(0.31).setDepth(14);
        this.droneArt.set(drone.id, art);
      }
      art.setPosition(x, y - 25 + Math.sin(this.time.now / 400 + drone.id) * 4);
      let label = this.unitLabels.get(drone.id);
      if (!label) {
        label = this.add.text(x, y + 38, '', { fontFamily: 'sans-serif', fontSize: '22px', color: '#e7f9f5', backgroundColor: '#1b2638', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(17);
        this.unitLabels.set(drone.id, label);
      }
      label.setPosition(x, y + 38).setText(`${DRONES[drone.kind].name} ${'★'.repeat(drone.grade)}`);
    }
    for (const [id, label] of this.unitLabels) { if (!s.drones.some(d => d.id === id)) { label.destroy(); this.unitLabels.delete(id); } }
    for (const [id, art] of this.droneArt) if (!s.drones.some(d => d.id === id)) { art.destroy(); this.droneArt.delete(id); }
    for (const enemy of s.enemies) {
      const x = center(enemy.x); const y = center(enemy.y);
      this.units.fillStyle(0x112331, 0.35); this.units.fillEllipse(x, y + 12, 65, 24);
      let actor = this.aliens.get(enemy.id);
      if (!actor) {
        actor = this.add.spine(x, y + 12, enemy.id % 3 === 0 ? 'slime' : 'alien', 'idle', true).setScale(0.38).setDepth(13);
        this.aliens.set(enemy.id, actor);
      }
      actor.setPosition(x, y + 12);
      actor.timeScale = s.status === 'paused' ? 0 : enemy.slowTime > 0 ? 0.5 : 1;
      this.units.fillStyle(0x162c36); this.units.fillRoundedRect(x - 28, y - 85, 56, 7, 3);
      this.units.fillStyle(enemy.burnTime > 0 ? 0xffac70 : 0xe79bce); this.units.fillRoundedRect(x - 28, y - 85, 56 * Math.max(0, enemy.health / WAVE_ONE.health), 7, 3);
    }
    for (const [id, actor] of this.aliens) if (!s.enemies.some(e => e.id === id)) {
      this.aliens.delete(id);
      actor.timeScale = 1;
      actor.play('die', false);
      this.time.delayedCall(500, () => actor.destroy());
    }
  }

  setMode(mode: GameMode): void {
    this.mode = mode; this.target = null;
    this.notice = mode === 'build' ? `빛나는 빈 칸을 클릭해 랜덤 드론을 소환하세요. (${SUMMON_COST} 에너지)` : '드론을 클릭하면 코드와 사거리를 볼 수 있어요.';
    this.publish();
  }
  toggleGrid(): void { this.showGrid = !this.showGrid; this.room.grid.setVisible(this.showGrid); this.publish(); }
  startWave(): void {
    this.inspectRange = false;
    if (this.simulation.startWave()) { this.mode = 'move'; this.notice = '일반 외계인 12마리가 다가와요! 전투 중에도 소환·합성이 가능해요.'; }
    else this.notice = '드론을 한 개 이상 소환한 뒤 시작해 주세요.';
    this.publish();
  }
  summon(): void { this.target = null; this.inspectRange = false; this.notice = this.simulation.summon(); this.publish(); }
  selectDrone(id: number): void { this.simulation.selectDrone(id); this.inspectRange = true; this.notice = '드론 선택'; this.publish(); this.options.onInspect?.(); }
  merge(): void { this.notice = this.simulation.merge(); this.publish(); }
  togglePause(): void { this.simulation.togglePause(); this.publish(); }
  reset(): void {
    for (const actor of this.aliens.values()) actor.destroy();
    for (const art of this.droneArt.values()) art.destroy();
    for (const label of this.unitLabels.values()) label.destroy();
    this.aliens.clear(); this.droneArt.clear(); this.unitLabels.clear();
    this.inspectRange = false;
    this.simulation = new DefenseSimulation(); this.mode = 'move'; this.target = null;
    this.tweens.killTweensOf(this.player); this.playerTile = { x: 11, y: 4 };
    this.player.setPosition(center(11), center(4) + 30); this.room.updateWall(4);
    this.notice = '새 작전을 준비해요. 드론 3개를 소환해 보세요.'; this.publish();
  }
  private publish(): void {
    const s = this.simulation;
    const message = s.status === 'cleared' ? '1웨이브 방어 성공! 내 드론의 순차 코드가 기지를 지켰어요.' : s.status === 'defeat' ? '기지 체력이 0이 됐어요. 드론을 더 소환하거나 합성해서 다시 도전해 보세요.' : this.notice;
    const state: DefenseState = { status: s.status, wave: s.wave, health: s.health, credits: s.credits, kills: s.kills, enemies: s.enemies.length, spawned: s.spawned, total: WAVE_ONE.enemies, escaped: s.escaped, elapsed: s.elapsed, drones: s.drones.map(({ cooldown, phaseTimer, ...drone }) => ({ ...drone })), selectedId: s.selectedId, player: { ...this.playerTile }, mode: this.mode, grid: this.showGrid, message };
    this.options.onState?.(state);
  }
}

import Phaser from 'phaser';
import { DefenseSimulation, ROUTE, isRouteTile } from './defense-simulation';
import { Room } from './room/room';
import { isWalkable } from './room/walkable';
import type { SpineActor } from './spine';
import { ROBOTS, WAVE_ONE } from './wave-one';
import type { DefenseState, GameMode, GameOptions, TilePosition } from './types';

const center = (value: number) => value * 100 + 50;

export class DefenseScene extends Phaser.Scene {
  simulation = new DefenseSimulation();
  mode: GameMode = 'move';
  showGrid = false;
  private room!: Room;
  private player!: SpineActor;
  private aliens = new Map<number, Phaser.GameObjects.Image>();
  private robotArt = new Map<number, SpineActor>();
  private inspectRange = false;
  private units!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private ranges!: Phaser.GameObjects.Graphics;
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
    this.createPlayer();
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

  private fitRoom(): void {
    const { width, height } = this.scale;
    const side = width > 760 ? 225 : 78;
    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(Math.min((width - side - 24) / 1600, (height - 200) / 1130));
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
    if (this.simulation.robots.some(d => d.x === tile.x && d.y === tile.y)) {
      const robot = this.simulation.robots.find(d => d.x === tile.x && d.y === tile.y)!;
      this.selectRobot(robot.id);
      this.draggedRobot = robot.id; this.dragStart = tile;
    } else if (this.mode === 'relocate' && this.simulation.selectedId !== null) {
      this.notice = this.simulation.moveRobot(this.simulation.selectedId, tile.x, tile.y);
      const moved = this.simulation.robots.find(r => r.id === this.simulation.selectedId);
      if (moved?.x === tile.x && moved.y === tile.y) this.mode = 'move';
    } else if (this.canMove(tile.x, tile.y)) this.target = tile;
    else this.notice = '방 안의 빈 바닥을 선택해 주세요.';
    this.publish();
  }

  private updateHover(pointer: Phaser.Input.Pointer): void {
    this.hover.clear();
    const tile = this.tileAt(pointer);
    if (!isWalkable(tile.x, tile.y)) return;
    this.hover.lineStyle(3, this.mode === 'relocate' ? (isRouteTile(tile.x, tile.y) ? 0xff7070 : 0xf3bd6f) : 0x89e4dd, 0.85);
    this.hover.strokeRect(tile.x * 100 + 5, tile.y * 100 + 5, 90, 90);
  }

  private canMove(x: number, y: number): boolean {
    return isWalkable(x, y) && !this.simulation.robots.some(t => t.x === x && t.y === y);
  }

  update(time: number, delta: number): void {
    if (!this.room) return;
    const previousHealth = this.simulation.health;
    const shots = this.interactionLocked ? [] : this.simulation.step(delta / 1000);
    if (this.simulation.health < previousHealth) {
      const hit = this.add.circle(center(this.playerTile.x), center(this.playerTile.y), 65, 0xff527d, 0.45).setDepth(21);
      const damage = this.add.text(center(this.playerTile.x), center(this.playerTile.y) - 75, `−${previousHealth - this.simulation.health}`, { fontFamily: 'sans-serif', fontSize: '32px', color: '#ff799c', fontStyle: 'bold' }).setOrigin(0.5).setDepth(22);
      this.tweens.add({ targets: hit, alpha: 0, scale: 1.5, duration: 300, onComplete: () => hit.destroy() });
      this.tweens.add({ targets: damage, alpha: 0, y: damage.y - 65, duration: 650, onComplete: () => damage.destroy() });
      if (this.simulation.status === 'defeat') {
        this.target = null; this.tweens.killTweensOf(this.player); this.player.play('idle', true); this.player.setAngle(-70);
      }
    }
    if (!this.interactionLocked && !['paused', 'defeat', 'cleared'].includes(this.simulation.status)) this.movePlayer(time);
    this.room.updateWall(Math.max(this.playerTile.y, ...this.simulation.robots.map(r => r.y)));
    this.drawUnits();
    for (const shot of shots) {
      const beam = this.add.line(0, 0, center(shot.from.x), center(shot.from.y) - 25, center(shot.to.x), center(shot.to.y) - 20, shot.player ? 0xb5fff3 : ROBOTS[shot.kind].color).setOrigin(0).setLineWidth(shot.chain ? 3 : 6).setDepth(15);
      this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
      const hit = this.add.circle(center(shot.to.x), center(shot.to.y) - 20, 25, ROBOTS[shot.kind].color, 0.8).setDepth(16);
      this.tweens.add({ targets: hit, alpha: 0, scale: 1.8, duration: 240, onComplete: () => hit.destroy() });
    }
    if (time >= this.publishAt) { this.publish(); this.publishAt = time + 120; }
  }

  private movePlayer(time: number): void {
    if (time < this.moveAt || !this.target) return;
    const next = this.findNextStep(this.target);
    if (!next) { this.target = null; return; }
    this.playerTile = next;
    this.simulation.player = { ...next };
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
    for (const robot of s.robots) {
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
      label.setPosition(x, y + 38).setText(`${ROBOTS[robot.kind].name} ${'★'.repeat(robot.grade)}`);
    }
    for (const [id, label] of this.unitLabels) { if (!s.robots.some(d => d.id === id)) { label.destroy(); this.unitLabels.delete(id); } }
    for (const [id, art] of this.robotArt) if (!s.robots.some(d => d.id === id)) { art.destroy(); this.robotArt.delete(id); }
    for (const enemy of s.enemies) {
      const x = center(enemy.x); const y = center(enemy.y);
      this.units.fillStyle(0x112331, 0.35); this.units.fillEllipse(x, y + 12, 65, 24);
      let actor = this.aliens.get(enemy.id);
      if (!actor) {
        actor = this.add.image(x, y - 22, 'monster-mint').setDisplaySize(78, 78).setDepth(13);
        this.aliens.set(enemy.id, actor);
      }
      actor.setPosition(x, y - 22 + Math.sin(this.time.now / 160 + enemy.id) * 3);
      const chasing = enemy.waypoint >= ROUTE.length;
      actor.setFlipX(chasing ? (enemy.chaseTarget?.x ?? s.player.x) < enemy.x : enemy.waypoint === 3);
      actor.setTint(chasing ? 0xffb1bd : 0xffffff);
      this.units.fillStyle(0x162c36); this.units.fillRoundedRect(x - 28, y - 85, 56, 7, 3);
      this.units.fillStyle(enemy.burnTime > 0 ? 0xffac70 : 0xe79bce); this.units.fillRoundedRect(x - 28, y - 85, 56 * Math.max(0, enemy.health / WAVE_ONE.health), 7, 3);
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
  summon(): void {
    this.target = null; this.inspectRange = true; this.notice = this.simulation.summon();
    this.mode = 'move'; this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  selectRobot(id: number): void {
    this.simulation.selectRobot(id); this.inspectRange = true; this.mode = 'relocate'; this.target = null;
    this.notice = '빈 바닥을 누르거나 로봇을 드래그해서 배치하세요.';
    this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  merge(): void { this.notice = this.simulation.merge(); this.publish(); }
  togglePause(): void { this.simulation.togglePause(); this.publish(); }
  reset(): void {
    for (const actor of this.aliens.values()) actor.destroy();
    for (const art of this.robotArt.values()) art.destroy();
    for (const label of this.unitLabels.values()) label.destroy();
    this.aliens.clear(); this.robotArt.clear(); this.unitLabels.clear();
    this.inspectRange = false;
    this.simulation = new DefenseSimulation(); this.mode = 'move'; this.target = null;
    this.tweens.killTweensOf(this.player); this.playerTile = { ...this.simulation.player };
    this.player.setAngle(0);
    this.player.setPosition(center(this.playerTile.x), center(this.playerTile.y) + 30); this.room.updateWall(this.playerTile.y);
    this.draggedRobot = null; this.dragStart = null; this.moveAt = 0;
    this.notice = '바닥 클릭·터치로 이동 · 로봇 선택 후 빈 바닥에 배치';
    this.options.parent.focus({ preventScroll: true }); this.publish();
  }
  private publish(): void {
    const s = this.simulation;
    const message = s.status === 'cleared' ? '괴물을 모두 처치했어요!' : s.status === 'defeat' ? '괴물의 공격으로 캐릭터 체력이 0이 됐어요. 게임 오버!' : this.notice;
    const state: DefenseState = { status: s.status, wave: s.wave, health: s.health, credits: s.credits, kills: s.kills, enemies: s.enemies.length, spawned: s.spawned, total: WAVE_ONE.enemies, escaped: s.escaped, elapsed: s.elapsed, countdown: Math.ceil(s.countdown), robots: s.robots.map(({ cooldown, phaseTimer, ...robot }) => ({ ...robot })), selectedId: s.selectedId, player: { ...this.playerTile }, mode: this.mode, grid: this.showGrid, message };
    this.options.onState?.(state);
  }
}

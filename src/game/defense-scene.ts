import Phaser from 'phaser';
import { DefenseSimulation, ROUTE } from './defense-simulation';
import { Room } from './room/room';
import { isWalkable } from './room/walkable';
import type { DefenseState, GameMode, GameOptions, TilePosition } from './types';

const center = (value: number) => value * 100 + 50;

export class DefenseScene extends Phaser.Scene {
  simulation = new DefenseSimulation();
  mode: GameMode = 'move';
  showGrid = false;
  private room!: Room;
  private player!: Phaser.GameObjects.Container;
  private units!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private target: TilePosition | null = null;
  private playerTile = { x: 7, y: 6 };
  private notice = '방어 준비 완료. 포탑을 배치해 보세요.';
  private publishAt = 0;
  private moveAt = 0;
  private options: GameOptions;

  constructor(options: GameOptions) { super('DefenseScene'); this.options = options; }

  preload(): void {
    const base = this.options.assetBase ?? `${import.meta.env.BASE_URL}games/space/`;
    this.load.image('room-tiles', `${base}SPACE_MAP_TILESET.png`);
    this.load.on('loaderror', () => this.options.onError?.('방 리소스를 불러오지 못했습니다. 새로고침해 주세요.'));
  }

  create(): void {
    if (!this.textures.exists('room-tiles')) return;
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
    this.hover = this.add.graphics().setDepth(4);
    this.createPlayer();
    this.createCore();
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
    const art = this.add.graphics();
    art.fillStyle(0x071623, 0.35); art.fillEllipse(0, 33, 65, 23);
    art.fillStyle(0x758cbe); art.fillRoundedRect(-28, -14, 56, 43, 10);
    art.fillStyle(0xe1e8ff); art.fillRoundedRect(-25, -46, 50, 48, 17);
    art.fillStyle(0x192e54); art.fillRoundedRect(-19, -34, 38, 21, 8);
    art.fillStyle(0x7fe8e2); art.fillRect(-12, -29, 19, 5);
    art.fillStyle(0xf2be6f); art.fillRect(-6, 6, 12, 11);
    art.fillStyle(0xd5dfff); art.fillRect(-22, 23, 16, 17); art.fillRect(6, 23, 16, 17);
    this.player = this.add.container(center(this.playerTile.x), center(this.playerTile.y), [art]).setDepth(20);
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
    this.cameras.main.setZoom(Math.min(width / 1900, height / 1700));
    this.cameras.main.centerOn(800, 710);
  }

  private tileAt(pointer: Phaser.Input.Pointer): TilePosition {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(world.x / 100), y: Math.floor(world.y / 100) };
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    this.options.parent.focus({ preventScroll: true });
    if (this.simulation.status === 'paused' || this.simulation.status === 'defeat') return;
    const tile = this.tileAt(pointer);
    if (this.mode === 'build') {
      if (tile.x === this.playerTile.x && tile.y === this.playerTile.y) this.notice = '대원이 있는 자리에는 배치할 수 없습니다.';
      else this.notice = this.simulation.placeTurret(tile.x, tile.y);
    } else if (this.mode === 'remove') this.notice = this.simulation.removeTurret(tile.x, tile.y);
    else if (this.canMove(tile.x, tile.y)) this.target = tile;
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
    return isWalkable(x, y) && !(x === 8 && y === 3) && !this.simulation.turrets.some(t => t.x === x && t.y === y);
  }

  update(time: number, delta: number): void {
    if (!this.room) return;
    const shots = this.simulation.step(delta / 1000);
    if (!['paused', 'defeat'].includes(this.simulation.status)) this.movePlayer(time);
    this.drawUnits();
    for (const shot of shots) {
      const beam = this.add.line(0, 0, center(shot.from.x), center(shot.from.y), center(shot.to.x), center(shot.to.y), 0xa2fff3).setOrigin(0).setLineWidth(5).setDepth(15);
      this.tweens.add({ targets: beam, alpha: 0, duration: 130, onComplete: () => beam.destroy() });
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
    this.tweens.add({ targets: this.player, x: center(next.x), y: center(next.y), duration: 145 });
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
    for (const turret of this.simulation.turrets) {
      const x = center(turret.x); const y = center(turret.y);
      this.units.fillStyle(0x0d2634); this.units.fillCircle(x, y + 8, 38);
      this.units.lineStyle(4, 0x75d8df); this.units.strokeCircle(x, y, 30);
      this.units.fillStyle(0x7adbd6); this.units.fillRoundedRect(x - 21, y - 20, 42, 37, 7);
      this.units.fillStyle(0xf5c07c); this.units.fillRect(x - 8, y - 42, 16, 33);
    }
    for (const enemy of this.simulation.enemies) {
      const x = center(enemy.x); const y = center(enemy.y);
      this.units.fillStyle(0xff829c); this.units.fillTriangle(x, y - 27, x - 29, y + 20, x + 29, y + 20);
      this.units.fillStyle(0x502542); this.units.fillCircle(x, y + 5, 10);
    }
  }

  setMode(mode: GameMode): void {
    this.mode = mode; this.target = null;
    this.notice = mode === 'build' ? '빈 바닥을 클릭해 포탑을 배치하세요. (75 에너지)' : mode === 'remove' ? '회수할 포탑을 클릭하세요.' : '바닥 클릭 또는 방향키 · WASD로 이동하세요.';
    this.publish();
  }
  toggleGrid(): void { this.showGrid = !this.showGrid; this.room.grid.setVisible(this.showGrid); this.publish(); }
  startWave(): void {
    if (this.simulation.startWave()) { this.mode = 'move'; this.notice = '침입 감지! 코어를 방어하세요.'; }
    else this.notice = '포탑을 한 개 이상 배치한 뒤 시작해 주세요.';
    this.publish();
  }
  togglePause(): void { this.simulation.togglePause(); this.publish(); }
  reset(): void {
    this.simulation = new DefenseSimulation(); this.mode = 'move'; this.target = null;
    this.tweens.killTweensOf(this.player); this.playerTile = { x: 7, y: 6 };
    this.player.setPosition(center(7), center(6)); this.room.updateWall(6);
    this.notice = '방을 초기화했습니다. 다시 방어를 준비하세요.'; this.publish();
  }
  private publish(): void {
    const s = this.simulation;
    const message = s.status === 'cleared' ? '방어 성공! 에너지를 보충하고 다음 웨이브를 준비하세요.' : s.status === 'defeat' ? '코어가 파괴되었습니다. 방을 초기화해 다시 도전하세요.' : this.notice;
    const state: DefenseState = { status: s.status, wave: s.wave, health: s.health, credits: s.credits, kills: s.kills, enemies: s.enemies.length, turrets: s.turrets.length, player: { ...this.playerTile }, mode: this.mode, grid: this.showGrid, message };
    this.options.onState?.(state);
  }
}

import { isWalkable } from './room/walkable.ts';
import type { GameStatus, TilePosition } from './types.ts';

export const TURRET_COST = 75;
export type Turret = TilePosition & { id: number; cooldown: number };
export type Enemy = TilePosition & { id: number; health: number; waypoint: number };
export type Shot = { from: TilePosition; to: TilePosition };
export const ROUTE: readonly TilePosition[] = [{ x: 1, y: 7 }, { x: 8, y: 7 }, { x: 8, y: 3 }];

export function isRouteTile(x: number, y: number): boolean {
  return (y === 7 && x >= 1 && x <= 8) || (x === 8 && y >= 3 && y <= 7);
}

export class DefenseSimulation {
  status: GameStatus = 'ready';
  wave = 0;
  health = 100;
  credits = 300;
  kills = 0;
  turrets: Turret[] = [];
  enemies: Enemy[] = [];
  private sequence = 0;
  private remaining = 0;
  private spawnTimer = 0;

  placeTurret(x: number, y: number): string {
    if (this.status !== 'ready' && this.status !== 'cleared') return '웨이브가 끝난 뒤 포탑을 배치해 주세요.';
    if (!isWalkable(x, y) || y >= 8 || isRouteTile(x, y)) return '이동 경로와 벽을 제외한 바닥에 배치해 주세요.';
    if (this.turrets.some(t => t.x === x && t.y === y)) return '이미 포탑이 있는 자리입니다.';
    if (this.credits < TURRET_COST) return '에너지가 부족합니다.';
    this.turrets.push({ id: ++this.sequence, x, y, cooldown: 0 });
    this.credits -= TURRET_COST;
    return '펄스 포탑을 배치했습니다.';
  }

  removeTurret(x: number, y: number): string {
    if (this.status !== 'ready' && this.status !== 'cleared') return '웨이브가 끝난 뒤 회수해 주세요.';
    const index = this.turrets.findIndex(t => t.x === x && t.y === y);
    if (index === -1) return '회수할 포탑을 선택해 주세요.';
    this.turrets.splice(index, 1);
    this.credits += TURRET_COST;
    return '포탑을 회수하고 에너지를 돌려받았습니다.';
  }

  startWave(): boolean {
    if (!['ready', 'cleared'].includes(this.status) || this.turrets.length === 0) return false;
    this.wave++;
    this.remaining = 4 + this.wave * 2;
    this.spawnTimer = 0;
    this.status = 'running';
    return true;
  }

  togglePause(): void {
    if (this.status === 'running') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'running';
  }

  step(seconds: number): Shot[] {
    if (this.status !== 'running') return [];
    const dt = Math.min(Math.max(seconds, 0), 0.05);
    this.spawnTimer -= dt;
    if (this.remaining > 0 && this.spawnTimer <= 0) {
      this.enemies.push({ ...ROUTE[0], id: ++this.sequence, health: 45 + this.wave * 10, waypoint: 1 });
      this.remaining--;
      this.spawnTimer = 1.1;
    }
    this.moveEnemies(dt);
    const shots = this.fireTurrets(dt);
    this.enemies = this.enemies.filter(e => {
      if (e.health > 0) return true;
      this.kills++;
      this.credits += 15;
      return false;
    });
    if (this.health <= 0) { this.health = 0; this.status = 'defeat'; }
    else if (this.remaining === 0 && this.enemies.length === 0) { this.status = 'cleared'; this.credits += 50; }
    return shots;
  }

  private moveEnemies(dt: number): void {
    this.enemies = this.enemies.filter(enemy => {
      const target = ROUTE[enemy.waypoint];
      const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
      const movement = dt * (0.7 + this.wave * 0.07);
      if (distance <= movement) {
        enemy.x = target.x; enemy.y = target.y; enemy.waypoint++;
        if (enemy.waypoint === ROUTE.length) { this.health -= 10; return false; }
      } else {
        enemy.x += (target.x - enemy.x) / distance * movement;
        enemy.y += (target.y - enemy.y) / distance * movement;
      }
      return true;
    });
  }

  private fireTurrets(dt: number): Shot[] {
    const shots: Shot[] = [];
    for (const turret of this.turrets) {
      turret.cooldown = Math.max(0, turret.cooldown - dt);
      const target = this.enemies.find(e => e.health > 0 && Math.hypot(e.x - turret.x, e.y - turret.y) <= 4);
      if (!target || turret.cooldown > 0) continue;
      shots.push({ from: { x: turret.x, y: turret.y }, to: { x: target.x, y: target.y } });
      target.health -= 20;
      turret.cooldown = 0.5;
    }
    return shots;
  }
}

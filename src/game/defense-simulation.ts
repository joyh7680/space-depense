import { isWalkable } from './room/walkable.ts';
import { DEPLOY_SLOTS, DRONE_KINDS, DRONES, MAX_GRADE, SUMMON_COST, WAVE_ONE } from './wave-one.ts';
import type { CodeBlock, DroneKind, DroneState, GameStatus, TilePosition } from './types.ts';

export type Drone = DroneState & { cooldown: number; phaseTimer: number };
export type Enemy = TilePosition & {
  id: number; health: number; waypoint: number; burnTime: number; burnDamage: number; slowTime: number;
};
export type Shot = { from: TilePosition; to: TilePosition; kind: DroneKind; chain?: boolean };
export const ROUTE: readonly TilePosition[] = [{ x: 1, y: 7 }, { x: 8, y: 7 }, { x: 8, y: 3 }];
export function isRouteTile(x: number, y: number): boolean {
  return (y === 7 && x >= 1 && x <= 8) || (x === 8 && y >= 3 && y <= 7);
}
const distance = (a: TilePosition, b: TilePosition) => Math.hypot(a.x - b.x, a.y - b.y);

export class DefenseSimulation {
  status: GameStatus = 'ready';
  wave = 0;
  health = 100;
  credits = 300;
  kills = 0;
  escaped = 0;
  spawned = 0;
  elapsed = 0;
  selectedId: number | null = null;
  drones: Drone[] = [];
  enemies: Enemy[] = [];
  private sequence = 0;
  private spawnTimer = 0;
  private random: () => number;

  constructor(random: () => number = Math.random) { this.random = random; }
  get canDeploy(): boolean { return this.status === 'ready' || this.status === 'running'; }

  placeDrone(x: number, y: number): string {
    if (!this.canDeploy) return '준비 중이거나 전투 중일 때 소환할 수 있어요.';
    if (!DEPLOY_SLOTS.some(slot => slot.x === x && slot.y === y) || !isWalkable(x, y) || isRouteTile(x, y)) return '빛나는 드론 배치 칸을 선택해 주세요.';
    if (this.drones.some(d => d.x === x && d.y === y)) return '이미 드론이 있는 칸이에요.';
    if (this.credits < SUMMON_COST) return '에너지가 부족해요. 외계인을 처치하면 에너지를 얻어요.';
    const kind = DRONE_KINDS[Math.min(2, Math.max(0, Math.floor(this.random() * 3)))];
    const config = DRONES[kind];
    const drone: Drone = { id: ++this.sequence, x, y, kind, grade: 1, range: config.range, damage: config.damage, cooldown: 0, phaseTimer: 0, activeBlock: 'find', attacks: 0, targetId: null };
    this.drones.push(drone);
    this.selectedId = drone.id;
    this.credits -= SUMMON_COST;
    return `${config.name} 드론 소환! 드론을 선택하면 예제 코드와 사거리를 볼 수 있어요.`;
  }
  summon(): string {
    if (!this.canDeploy) return '지금은 소환할 수 없어요.';
    const slot = DEPLOY_SLOTS.find(p => !this.drones.some(d => d.x === p.x && d.y === p.y));
    return slot ? this.placeDrone(slot.x, slot.y) : '배치 칸이 가득 찼어요. 같은 드론을 합성해 보세요.';
  }
  selectDrone(id: number): void { if (this.drones.some(d => d.id === id)) this.selectedId = id; }
  merge(): string {
    if (!this.canDeploy) return '준비 중이거나 전투 중일 때 합성할 수 있어요.';
    const drone = this.drones.find(d => d.id === this.selectedId);
    if (!drone) return '합성할 드론을 먼저 선택해 주세요.';
    if (drone.grade >= MAX_GRADE) return '최대 등급인 3성 드론이에요.';
    const partner = this.drones.find(d => d.id !== drone.id && d.kind === drone.kind && d.grade === drone.grade);
    if (!partner) return '같은 종류·같은 등급의 드론이 하나 더 필요해요.';
    this.drones = this.drones.filter(d => d.id !== partner.id);
    drone.grade++;
    drone.damage = Math.round(DRONES[drone.kind].damage * 2.4 ** (drone.grade - 1));
    drone.range = DRONES[drone.kind].range + (drone.grade - 1) * 0.4;
    drone.attacks += partner.attacks;
    // Keep the selected drone's identity, code and cooldown.
    return `${DRONES[drone.kind].name} ${drone.grade}성으로 합성! 공격력과 사거리가 늘었어요.`;
  }
  startWave(): boolean {
    if (this.status !== 'ready' || this.drones.length === 0) return false;
    this.wave = 1; this.spawnTimer = 0.6; this.status = 'running'; return true;
  }
  togglePause(): void {
    if (this.status === 'running') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'running';
  }
  step(seconds: number): Shot[] {
    if (this.status !== 'running' || !Number.isFinite(seconds)) return [];
    const dt = Math.min(Math.max(seconds, 0), 0.05);
    this.elapsed += dt; this.spawnTimer -= dt;
    if (this.spawned < WAVE_ONE.enemies && this.spawnTimer <= 0) {
      this.enemies.push({ ...ROUTE[0], id: ++this.sequence, health: WAVE_ONE.health, waypoint: 1, burnTime: 0, burnDamage: 0, slowTime: 0 });
      this.spawned++; this.spawnTimer += WAVE_ONE.spawnInterval;
    }
    for (const enemy of this.enemies) {
      if (enemy.burnTime > 0) enemy.health -= enemy.burnDamage * Math.min(dt, enemy.burnTime);
      enemy.burnTime = Math.max(0, enemy.burnTime - dt);
      enemy.slowTime = Math.max(0, enemy.slowTime - dt);
    }
    this.collectKills(); this.moveEnemies(dt);
    if (this.health <= 0) { this.health = 0; this.status = 'defeat'; return []; }
    const shots = this.executeDrones(dt);
    this.collectKills();
    if (this.spawned === WAVE_ONE.enemies && this.enemies.length === 0) {
      this.status = 'cleared'; this.credits += WAVE_ONE.clearEnergy;
    }
    return shots;
  }
  private collectKills(): void {
    this.enemies = this.enemies.filter(e => {
      if (e.health > 0) return true;
      this.kills++; this.credits += WAVE_ONE.killEnergy; return false;
    });
  }
  private moveEnemies(dt: number): void {
    this.enemies = this.enemies.filter(enemy => {
      const target = ROUTE[enemy.waypoint];
      const gap = distance(target, enemy);
      const movement = dt * WAVE_ONE.speed * (enemy.slowTime > 0 ? 0.6 : 1);
      if (gap <= movement) {
        enemy.x = target.x; enemy.y = target.y; enemy.waypoint++;
        if (enemy.waypoint === ROUTE.length) { this.health -= WAVE_ONE.breachDamage; this.escaped++; return false; }
      } else {
        enemy.x += (target.x - enemy.x) / gap * movement;
        enemy.y += (target.y - enemy.y) / gap * movement;
      }
      return true;
    });
  }
  private phase(drone: Drone, block: CodeBlock, timer: number): void {
    drone.activeBlock = block; drone.phaseTimer = timer;
  }
  private executeDrones(dt: number): Shot[] {
    const shots: Shot[] = [];
    for (const drone of this.drones) {
      drone.cooldown = Math.max(0, drone.cooldown - dt);
      drone.phaseTimer = Math.max(0, drone.phaseTimer - dt);
      if (drone.phaseTimer > 0) continue;
      if (drone.activeBlock === 'wait') { this.phase(drone, 'find', 0.16); continue; }
      if (drone.activeBlock === 'find') {
        const targets = this.enemies.filter(e => e.health > 0 && distance(e, drone) <= drone.range);
        targets.sort((a, b) => distance(a, drone) - distance(b, drone) || a.id - b.id);
        drone.targetId = targets[0]?.id ?? null;
        this.phase(drone, targets.length ? 'attack' : 'wait', targets.length ? 0.16 : 0.25); continue;
      }
      const target = this.enemies.find(e => e.id === drone.targetId && e.health > 0 && distance(e, drone) <= drone.range);
      if (!target) { drone.targetId = null; this.phase(drone, 'find', 0.16); continue; }
      if (drone.cooldown > 0) { this.phase(drone, 'wait', drone.cooldown); continue; }
      shots.push({ from: { x: drone.x, y: drone.y }, to: { x: target.x, y: target.y }, kind: drone.kind });
      target.health -= drone.damage;
      if (drone.kind === 'fire') { target.burnTime = 2; target.burnDamage = drone.damage * 0.2; }
      if (drone.kind === 'ice') target.slowTime = 1.4;
      if (drone.kind === 'electric') {
        const next = this.enemies.find(e => e.id !== target.id && e.health > 0 && distance(e, target) <= 1.4 && distance(e, drone) <= drone.range);
        if (next) { next.health -= drone.damage * 0.5; shots.push({ from: { x: target.x, y: target.y }, to: { x: next.x, y: next.y }, kind: drone.kind, chain: true }); }
      }
      drone.attacks++; drone.cooldown = 0.9; this.phase(drone, 'wait', 0.58);
    }
    return shots;
  }
}

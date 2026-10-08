import { isWalkable } from './room/walkable.ts';
import { DEPLOY_SLOTS, ROBOT_KINDS, ROBOTS, MAX_GRADE, ROBOT_CHARGE_COST, WAVE_ONE } from './wave-one.ts';
import type { CodeBlock, ElementEnergy, RobotKind, RobotState, GameStatus, TilePosition } from './types.ts';

export type Robot = RobotState & { cooldown: number; phaseTimer: number };
export type Enemy = TilePosition & {
  id: number; health: number; waypoint: number; burnTime: number; burnDamage: number; slowTime: number;
};
export type Shot = { from: TilePosition; to: TilePosition; kind: RobotKind; chain?: boolean; player?: boolean };
export const ROUTE: readonly TilePosition[] = [{ x: 1, y: 4 }, { x: 12, y: 4 }, { x: 12, y: 6 }, { x: 3, y: 6 }];
export function isRouteTile(x: number, y: number): boolean {
  return ROUTE.slice(1).some((end, i) => {
    const start = ROUTE[i];
    return x >= Math.min(start.x, end.x) && x <= Math.max(start.x, end.x) && y >= Math.min(start.y, end.y) && y <= Math.max(start.y, end.y);
  });
}
const distance = (a: TilePosition, b: TilePosition) => Math.hypot(a.x - b.x, a.y - b.y);

export class DefenseSimulation {
  status: GameStatus = 'ready';
  wave = 0;
  health = 100;
  credits = 300;
  elementEnergy: ElementEnergy = { fire: 0, electric: 0, ice: 0 };
  kills = 0;
  escaped = 0;
  spawned = 0;
  elapsed = 0;
  countdown = 5;
  player: TilePosition = { x: 5, y: 5 };
  private playerCooldown = 0;
  selectedId: number | null = null;
  robots: Robot[] = [];
  enemies: Enemy[] = [];
  private sequence = 0;
  private spawnTimer = 0;
  private random: () => number;

  constructor(random: () => number = Math.random) { this.random = random; }
  get canDeploy(): boolean { return this.status === 'ready' || this.status === 'running'; }
  get robotCount(): number { return this.robots.length; }

  canMovePlayer(x: number, y: number): boolean {
    return isWalkable(x, y) && !isRouteTile(x, y) && !this.robots.some(r => r.x === x && r.y === y);
  }
  nextPlayerStep(target: TilePosition): TilePosition | null {
    if (!this.canMovePlayer(target.x, target.y)) return null;
    const queue: { tile: TilePosition; first: TilePosition | null }[] = [{ tile: this.player, first: null }];
    const visited = new Set([`${this.player.x},${this.player.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      if (entry.tile.x === target.x && entry.tile.y === target.y) return entry.first;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const tile = { x: entry.tile.x + dx, y: entry.tile.y + dy };
        const key = `${tile.x},${tile.y}`;
        if (visited.has(key) || !this.canMovePlayer(tile.x, tile.y)) continue;
        visited.add(key); queue.push({ tile, first: entry.first ?? tile });
      }
    }
    return null;
  }

  placeRobot(x: number, y: number, kind: RobotKind): string {
    if (!this.canDeploy) return '준비 중이거나 전투 중일 때 소환할 수 있어요.';
    if (!isWalkable(x, y) || isRouteTile(x, y) || (this.player.x === x && this.player.y === y)) return '길 밖의 빈 바닥을 선택해 주세요.';
    if (this.robots.length >= 8) return '로봇은 최대 8대까지 소환할 수 있어요.';
    if (this.robots.some(d => d.x === x && d.y === y)) return '이미 로봇이 있는 칸이에요.';
    if (this.elementEnergy[kind] < ROBOT_CHARGE_COST) return `${ROBOTS[kind].energyName} 에너지 ${ROBOT_CHARGE_COST}개를 모으면 ${ROBOTS[kind].name}이 충전돼요.`;
    const config = ROBOTS[kind];
    const robot: Robot = { id: ++this.sequence, x, y, kind, grade: 1, range: config.range, damage: config.damage, cooldown: 0, phaseTimer: 0, activeBlock: 'find', attacks: 0, targetId: null };
    this.robots.push(robot);
    this.selectedId = robot.id;
    this.elementEnergy[kind] -= ROBOT_CHARGE_COST;
    return `${config.name} 소환! 선택 후 빈 바닥에 배치할 수 있어요.`;
  }
  summon(kind: RobotKind): string {
    if (!this.canDeploy) return '지금은 소환할 수 없어요.';
    const candidates = [...DEPLOY_SLOTS];
    for (let y = 3; y <= 11; y++) for (let x = 1; x <= 14; x++) {
      if (isWalkable(x, y) && !isRouteTile(x, y)) candidates.push({ x, y });
    }
    const slot = candidates.find(p => !this.robots.some(d => d.x === p.x && d.y === p.y) && !(p.x === this.player.x && p.y === this.player.y));
    return slot ? this.placeRobot(slot.x, slot.y, kind) : '배치 칸이 가득 찼어요. 같은 로봇을 합성해 보세요.';
  }
  selectRobot(id: number): void { if (this.robots.some(d => d.id === id)) this.selectedId = id; }
  moveRobot(id: number, x: number, y: number): string {
    const robot = this.robots.find(r => r.id === id);
    if (!this.canDeploy || !robot) return '옮길 로봇을 선택해 주세요.';
    if (!isWalkable(x, y) || isRouteTile(x, y) || (this.player.x === x && this.player.y === y)) return '길 밖의 빈 바닥에 배치해 주세요.';
    if (this.robots.some(r => r.id !== id && r.x === x && r.y === y)) return '다른 로봇이 있는 자리예요.';
    robot.x = x; robot.y = y; robot.targetId = null;
    robot.activeBlock = 'find'; robot.phaseTimer = 0;
    return '로봇 배치 완료! 다른 로봇도 선택해서 옮길 수 있어요.';
  }
  merge(): string {
    if (!this.canDeploy) return '준비 중이거나 전투 중일 때 합성할 수 있어요.';
    const robot = this.robots.find(d => d.id === this.selectedId);
    if (!robot) return '합성할 로봇을 먼저 선택해 주세요.';
    if (robot.grade >= MAX_GRADE) return '최대 등급인 3성 로봇이에요.';
    const partner = this.robots.find(d => d.id !== robot.id && d.kind === robot.kind && d.grade === robot.grade);
    if (!partner) return '같은 종류·같은 등급의 로봇이 하나 더 필요해요.';
    this.robots = this.robots.filter(d => d.id !== partner.id);
    robot.grade++;
    robot.damage = Math.round(ROBOTS[robot.kind].damage * 2.4 ** (robot.grade - 1));
    robot.range = ROBOTS[robot.kind].range + (robot.grade - 1) * 0.4;
    robot.attacks += partner.attacks;
    // Keep the selected robot's identity, code and cooldown.
    return `${ROBOTS[robot.kind].name} ${robot.grade}성으로 합성! 공격력과 사거리가 늘었어요.`;
  }
  startWave(): boolean {
    if (this.status !== 'ready') return false;
    this.countdown = 0; this.wave = 1; this.spawnTimer = 0; this.status = 'running'; return true;
  }
  togglePause(): void {
    if (this.status === 'running') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'running';
  }
  step(seconds: number): Shot[] {
    if (!Number.isFinite(seconds)) return [];
    const dt = Math.min(Math.max(seconds, 0), 0.05);
    if (this.status === 'ready') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 0.000001) this.startWave();
      return [];
    }
    if (this.status !== 'running') return [];
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
    const shots = this.executeRobots(dt);
    this.playerCooldown = Math.max(0, this.playerCooldown - dt);
    const target = this.enemies.filter(e => e.health > 0 && distance(e, this.player) <= 4).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    if (target && this.playerCooldown === 0) {
      target.health -= 14;
      shots.push({ from: { ...this.player }, to: { x: target.x, y: target.y }, kind: 'electric', player: true });
      this.playerCooldown = 0.8;
    }
    this.collectKills();
    if (this.spawned === WAVE_ONE.enemies && this.enemies.length === 0) {
      this.status = 'cleared'; this.credits += WAVE_ONE.clearEnergy;
    }
    return shots;
  }
  private collectKills(): void {
    this.enemies = this.enemies.filter(e => {
      if (e.health > 0) return true;
      // Roll once per defeated monster, including damage-over-time and chain kills.
      const kind = ROBOT_KINDS[Math.min(ROBOT_KINDS.length - 1, Math.max(0, Math.floor(this.random() * ROBOT_KINDS.length)))];
      this.elementEnergy[kind]++;
      this.kills++; this.credits += WAVE_ONE.killEnergy; return false;
    });
  }
  private moveEnemies(dt: number): void {
    this.enemies = this.enemies.filter(enemy => {
      if (this.health === 0) return true;
      const target = ROUTE[enemy.waypoint];
      const gap = distance(target, enemy);
      const movement = dt * WAVE_ONE.speed * (enemy.slowTime > 0 ? 0.6 : 1);
      if (gap <= movement) {
        enemy.x = target.x; enemy.y = target.y; enemy.waypoint++;
        if (enemy.waypoint === ROUTE.length) {
          this.escaped++; this.health = 0;
          return false;
        }
      } else {
        enemy.x += (target.x - enemy.x) / gap * movement;
        enemy.y += (target.y - enemy.y) / gap * movement;
      }
      return true;
    });
  }
  private phase(robot: Robot, block: CodeBlock, timer: number): void {
    robot.activeBlock = block; robot.phaseTimer = timer;
  }
  private executeRobots(dt: number): Shot[] {
    const shots: Shot[] = [];
    for (const robot of this.robots) {
      robot.cooldown = Math.max(0, robot.cooldown - dt);
      robot.phaseTimer = Math.max(0, robot.phaseTimer - dt);
      if (robot.phaseTimer > 0) continue;
      if (robot.activeBlock === 'wait') { this.phase(robot, 'find', 0.16); continue; }
      if (robot.activeBlock === 'find') {
        const targets = this.enemies.filter(e => e.health > 0 && distance(e, robot) <= robot.range);
        targets.sort((a, b) => distance(a, robot) - distance(b, robot) || a.id - b.id);
        robot.targetId = targets[0]?.id ?? null;
        this.phase(robot, targets.length ? 'attack' : 'wait', targets.length ? 0.16 : 0.25); continue;
      }
      const target = this.enemies.find(e => e.id === robot.targetId && e.health > 0 && distance(e, robot) <= robot.range);
      if (!target) { robot.targetId = null; this.phase(robot, 'find', 0.16); continue; }
      if (robot.cooldown > 0) { this.phase(robot, 'wait', robot.cooldown); continue; }
      shots.push({ from: { x: robot.x, y: robot.y }, to: { x: target.x, y: target.y }, kind: robot.kind });
      target.health -= robot.damage;
      if (robot.kind === 'fire') { target.burnTime = 2; target.burnDamage = robot.damage * 0.2; }
      if (robot.kind === 'ice') target.slowTime = 1.4;
      if (robot.kind === 'electric') {
        const next = this.enemies.find(e => e.id !== target.id && e.health > 0 && distance(e, target) <= 1.4 && distance(e, robot) <= robot.range);
        if (next) { next.health -= robot.damage * 0.5; shots.push({ from: { x: target.x, y: target.y }, to: { x: next.x, y: next.y }, kind: robot.kind, chain: true }); }
      }
      robot.attacks++; robot.cooldown = 0.9; this.phase(robot, 'wait', 0.58);
    }
    return shots;
  }
}

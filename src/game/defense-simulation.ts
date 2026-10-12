import { isWalkable } from './room/walkable.ts';
import { getCodingMission, isCodingBlock, validateRobotCode, type CodingBlockId } from './coding-missions.ts';
import { DEPLOY_SLOTS, ROBOT_KINDS, ROBOTS, MAX_GRADE, ROBOT_CHARGE_COST, SUMMONED_MONSTER, WAVE_ONE } from './wave-one.ts';
import type { CodeBlock, ElementEnergy, RobotKind, RobotState, GameStatus, TilePosition } from './types.ts';

export type Robot = RobotState & { cooldown: number; phaseTimer: number; burstRemaining: number };
export type Enemy = TilePosition & {
  id: number; health: number; waypoint: number; burnTime: number; burnDamage: number; slowTime: number;
  kind?: 'summoned';
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
  private bossSpawned = false;
  elapsed = 0;
  countdown = 5;
  player: TilePosition = { x: 5, y: 5 };
  private playerCooldown = 0;
  selectedId: number | null = null;
  robots: Robot[] = [];
  enemies: Enemy[] = [];
  private sequence = 0;
  private spawnTimer = 0;
  private robotSerial: Record<RobotKind, number> = { fire: 0, ice: 0, electric: 0 };
  private random: () => number;

  constructor(random: () => number = Math.random) { this.random = random; }
  get canDeploy(): boolean { return this.status === 'ready' || this.status === 'running'; }
  get robotCount(): number { return this.robots.length; }
  get deployedRobots(): Robot[] { return this.robots.filter(robot => robot.deployed); }
  get totalEnemies(): number { return WAVE_ONE.enemies + 1; }
  get monsterSummonCountdown(): number | null {
    return this.bossSpawned ? null : Math.ceil(Math.max(0, SUMMONED_MONSTER.summonDelay - this.elapsed - 0.000001));
  }

  private spawnBoss(): void {
    if (this.bossSpawned || this.elapsed < SUMMONED_MONSTER.summonDelay - 0.000001) return;
    this.bossSpawned = true;
    this.enemies.push({ ...ROUTE[0], id: ++this.sequence, kind: 'summoned', health: SUMMONED_MONSTER.health, waypoint: 1, burnTime: 0, burnDamage: 0, slowTime: 0 });
  }

  canMovePlayer(x: number, y: number): boolean {
    return isWalkable(x, y) && !isRouteTile(x, y) && !this.deployedRobots.some(r => r.x === x && r.y === y);
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
    if (this.deployedRobots.some(d => d.x === x && d.y === y)) return '이미 로봇이 있는 칸이에요.';
    if (this.elementEnergy[kind] < ROBOT_CHARGE_COST) return `${ROBOTS[kind].energyName} 에너지 ${ROBOT_CHARGE_COST}개를 모으면 ${ROBOTS[kind].name}이 충전돼요.`;
    this.createRobot(kind, { x, y });
    this.elementEnergy[kind] -= ROBOT_CHARGE_COST;
    return `${ROBOTS[kind].name} 소환! 선택 후 빈 바닥에 배치할 수 있어요.`;
  }
  private createRobot(kind: RobotKind, position: TilePosition | null, select = true): void {
    const config = ROBOTS[kind];
    const mission = getCodingMission(kind, this.wave);
    // Stored robots have no room tile until the player selects them from the hangar.
    const robot: Robot = { id: ++this.sequence, x: position?.x ?? -1, y: position?.y ?? -1, deployed: position !== null, kind, grade: 1, range: config.range, damage: config.damage, cooldown: 0, phaseTimer: 0, burstRemaining: 0, activeBlock: 'find', attacks: 0, targetId: null,
      serial: ++this.robotSerial[kind], code: mission.slots.map(() => null), missionStatus: 'waiting', missionMessage: mission.autoRun ? '공격 블록을 한 번 누르면 바로 공격이 활성화돼요.' : '블록을 조합하고 코드를 실행해 공격을 활성화하세요.' };
    this.robots.push(robot);
    if (select) this.selectedId = robot.id;
  }
  private findRobotSlot(): TilePosition | undefined {
    const candidates = [...DEPLOY_SLOTS];
    for (let y = 3; y <= 11; y++) for (let x = 1; x <= 14; x++) {
      if (isWalkable(x, y) && !isRouteTile(x, y)) candidates.push({ x, y });
    }
    return candidates.find(p => !this.deployedRobots.some(d => d.x === p.x && d.y === p.y) && !(p.x === this.player.x && p.y === this.player.y));
  }
  summon(kind: RobotKind): string {
    if (!this.canDeploy) return '지금은 소환할 수 없어요.';
    const slot = this.findRobotSlot();
    return slot ? this.placeRobot(slot.x, slot.y, kind) : '배치 칸이 가득 찼어요. 같은 로봇을 합성해 보세요.';
  }
  private deployRobot(robot: Robot): boolean {
    if (robot.deployed) return true;
    const slot = this.findRobotSlot();
    if (!slot) {
      robot.missionMessage = '배치할 빈 바닥이 없어요. 자리를 비운 뒤 다시 선택해 주세요.';
      return false;
    }
    robot.x = slot.x; robot.y = slot.y; robot.deployed = true;
    return true;
  }
  selectRobot(id: number): void {
    const robot = this.robots.find(robot => robot.id === id);
    if (!this.canDeploy || !robot || !this.deployRobot(robot)) return;
    this.selectedId = id;
  }
  updateCode(id: number, slot: number, block: CodingBlockId | null): void {
    const robot = this.robots.find(r => r.id === id);
    if (!this.canDeploy || !robot || robot.missionStatus === 'completed' || !Number.isInteger(slot) || slot < 0 || slot >= robot.code.length) return;
    const mission = getCodingMission(robot.kind, this.wave);
    if (block !== null && (!isCodingBlock(block) || !mission.palette.includes(block))) return;
    robot.code[slot] = block;
    robot.missionStatus = 'waiting'; robot.missionMessage = '준비되면 코드 실행을 눌러 주세요.';
    if (mission.autoRun && validateRobotCode(robot.kind, this.wave, robot.code).success) this.runCode(id);
  }
  runCode(id: number): string {
    const robot = this.robots.find(r => r.id === id);
    if (!this.canDeploy || !robot) return '지금은 코드를 실행할 수 없어요.';
    if (robot.missionStatus === 'completed') return robot.missionMessage;
    const result = validateRobotCode(robot.kind, this.wave, robot.code);
    if (result.success && !this.deployRobot(robot)) return robot.missionMessage;
    robot.missionStatus = result.success ? 'completed' : 'error';
    robot.missionMessage = result.message;
    robot.activeBlock = 'find'; robot.phaseTimer = 0;
    return result.message;
  }
  private autoSummon(): void {
    for (const kind of ROBOT_KINDS) {
      while (this.elementEnergy[kind] >= ROBOT_CHARGE_COST && this.robotCount < 8) {
        this.createRobot(kind, null, false);
        this.elementEnergy[kind] -= ROBOT_CHARGE_COST;
      }
    }
  }
  moveRobot(id: number, x: number, y: number): string {
    const robot = this.robots.find(r => r.id === id);
    if (!this.canDeploy || !robot) return '옮길 로봇을 선택해 주세요.';
    if (!robot.deployed) return '로봇 소환 버튼에서 로봇을 선택하면 방에 배치돼요.';
    if (!isWalkable(x, y) || isRouteTile(x, y) || (this.player.x === x && this.player.y === y)) return '길 밖의 빈 바닥에 배치해 주세요.';
    if (this.deployedRobots.some(r => r.id !== id && r.x === x && r.y === y)) return '다른 로봇이 있는 자리예요.';
    robot.x = x; robot.y = y; robot.targetId = null;
    robot.burstRemaining = 0;
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
    this.autoSummon();
    // Keep the selected robot's identity, code and cooldown.
    return `${ROBOTS[robot.kind].name} ${robot.grade}성으로 합성! 공격력과 사거리가 늘었어요.`;
  }
  startWave(): boolean {
    const nextWave = this.status === 'cleared';
    if ((this.status !== 'ready' && !nextWave) || this.wave >= 3) return false;
    this.wave = nextWave ? this.wave + 1 : 1;
    if (nextWave) {
      this.kills = 0; this.escaped = 0; this.spawned = 0; this.elapsed = 0;
      this.bossSpawned = false; this.playerCooldown = 0; this.selectedId = null;
      for (const robot of this.robots) {
        robot.code = getCodingMission(robot.kind, this.wave).slots.map(() => null);
        robot.missionStatus = 'waiting';
        robot.missionMessage = `웨이브 ${this.wave}: 블록 ${this.wave}개를 조합하고 코드를 실행해 주세요.`;
        robot.cooldown = 0; robot.phaseTimer = 0; robot.burstRemaining = 0;
        robot.activeBlock = 'find'; robot.targetId = null;
      }
    }
    this.countdown = 0; this.spawnTimer = 0; this.status = 'running'; return true;
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
    this.spawnBoss();
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
    if (this.spawned === WAVE_ONE.enemies && this.enemies.length === 0 && this.bossSpawned) {
      this.status = 'cleared'; this.credits += WAVE_ONE.clearEnergy;
    }
    return shots;
  }
  private collectKills(): void {
    this.enemies = this.enemies.filter(e => {
      if (e.health > 0) return true;
      // Each defeated monster grants three independently rolled elements.
      for (let reward = 0; reward < 3; reward++) {
        this.elementEnergy[this.randomKind()]++;
      }
      if (e.kind === 'summoned' && this.random() < SUMMONED_MONSTER.robotDropChance && this.robotCount < 8) {
        this.createRobot(this.randomKind(), null, false);
      }
      this.kills++; this.credits += WAVE_ONE.killEnergy; return false;
    });
    this.autoSummon();
  }
  private randomKind(): RobotKind {
    return ROBOT_KINDS[Math.min(ROBOT_KINDS.length - 1, Math.max(0, Math.floor(this.random() * ROBOT_KINDS.length)))];
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
    for (const robot of this.deployedRobots) {
      if (robot.missionStatus !== 'completed') continue;
      robot.cooldown = Math.max(0, robot.cooldown - dt);
      robot.phaseTimer = Math.max(0, robot.phaseTimer - dt);
      if (robot.phaseTimer > 0) continue;
      if (robot.activeBlock === 'wait') { this.phase(robot, 'find', 0.16); continue; }
      if (robot.activeBlock === 'find') {
        const targets = this.enemies.filter(e => e.health > 0 && distance(e, robot) <= robot.range);
        targets.sort((a, b) => distance(a, robot) - distance(b, robot) || a.id - b.id);
        robot.targetId = targets[0]?.id ?? null;
        const required = robot.code.includes('count-three') ? 3 : 1;
        const condition = targets.length >= required;
        if (robot.kind === 'ice') robot.burstRemaining = condition ? 1 : 0;
        this.phase(robot, condition ? 'attack' : 'wait', condition ? 0.16 : 0.25); continue;
      }
      const target = this.enemies.find(e => e.id === robot.targetId && e.health > 0 && distance(e, robot) <= robot.range);
      if (!target) { robot.targetId = null; robot.burstRemaining = 0; this.phase(robot, 'find', 0.16); continue; }
      const nearby = this.enemies.filter(e => e.health > 0 && distance(e, robot) <= robot.range);
      if (nearby.length < (robot.code.includes('count-three') ? 3 : 1)) {
        robot.targetId = null; this.phase(robot, 'find', 0.16); continue;
      }
      if (robot.cooldown > 0) { this.phase(robot, 'wait', robot.cooldown); continue; }
      shots.push({ from: { x: robot.x, y: robot.y }, to: { x: target.x, y: target.y }, kind: robot.kind });
      target.health -= robot.damage;
      if (robot.kind === 'fire') {
        for (const enemy of nearby.filter(e => distance(e, target) <= 1.6)) {
          if (enemy !== target) {
            enemy.health -= robot.damage;
            shots.push({ from: { x: target.x, y: target.y }, to: { x: enemy.x, y: enemy.y }, kind: 'fire', chain: true });
          }
          enemy.burnTime = 2; enemy.burnDamage = robot.damage * 0.2;
        }
      }
      if (robot.kind === 'ice') {
        target.slowTime = 1.4;
        robot.burstRemaining--;
        if (robot.burstRemaining > 0) { this.phase(robot, 'attack', 0.12); continue; }
      }
      if (robot.kind === 'electric') {
        const next = nearby.find(e => e.id !== target.id && e.health > 0);
        if (next) { next.health -= robot.damage * 0.5; shots.push({ from: { x: target.x, y: target.y }, to: { x: next.x, y: next.y }, kind: robot.kind, chain: true }); }
      }
      robot.attacks++; robot.cooldown = 0.9; this.phase(robot, 'wait', 0.58);
    }
    return shots;
  }
}

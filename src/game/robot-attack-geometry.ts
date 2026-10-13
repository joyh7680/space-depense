import type { TilePosition } from './types.ts';

// Simulation tiles are 100 world pixels. The beam continues through its target
// to the full range, so every enemy on that forward path can be hit once.
export function getBeamEndpoint(origin: TilePosition, target: TilePosition, range: number): TilePosition {
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { ...origin } : { x: origin.x + dx / length * range / 100, y: origin.y + dy / length * range / 100 };
}

export function isOnBeamPath(origin: TilePosition, endpoint: TilePosition, enemy: TilePosition, halfWidth: number): boolean {
  const dx = endpoint.x - origin.x, dy = endpoint.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return false;
  const ex = enemy.x - origin.x, ey = enemy.y - origin.y;
  const along = (ex * dx + ey * dy) / length;
  const across = Math.abs(ex * dy - ey * dx) / length;
  return along >= 0 && along <= length + 1e-9 && across <= halfWidth / 100 + 1e-9;
}

/**
 * F-C1 map with many salons: markers closer than `radius` pixels on screen
 * become one group (« 3 salons »), so pills never cover each other. Greedy,
 * in the list's order (nearest salon first), so the result is stable.
 */
export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

export function groupByDistance(
  points: readonly ScreenPoint[],
  radius: number,
): string[][] {
  const groups: string[][] = [];
  const taken = new Set<string>();
  const r2 = radius * radius;
  for (const p of points) {
    if (taken.has(p.id)) continue;
    const group = [p.id];
    taken.add(p.id);
    for (const q of points) {
      if (taken.has(q.id)) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      if (dx * dx + dy * dy <= r2) {
        group.push(q.id);
        taken.add(q.id);
      }
    }
    groups.push(group);
  }
  return groups;
}

/** One key per group, the same however the map moved: a kept marker keeps its focus. */
export const groupKey = (ids: readonly string[]): string =>
  [...ids].sort().join('|');

/**
 * F-C1 map with many salons: markers whose pills would overlap on screen
 * become one group (« 3 salons »). Greedy, in the list's order (nearest
 * salon first), so the result is stable; a group stands at its first
 * salon's point, so it never moves onto a neighbouring pill.
 */
export interface ScreenPill {
  id: string;
  /** Centre of the pill on screen, in px. */
  x: number;
  y: number;
  /** Width of the pill, in px (all pills are the same height). */
  width: number;
}

/** Pill height (44 px touch target) and the gap kept between two pills. */
export const PILL_HEIGHT = 44;
export const PILL_GAP = 8;

const overlap = (a: ScreenPill, b: ScreenPill): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + PILL_GAP &&
  Math.abs(a.y - b.y) < PILL_HEIGHT + PILL_GAP;

export function groupOverlapping(pills: readonly ScreenPill[]): string[][] {
  const groups: { anchor: ScreenPill; ids: string[] }[] = [];
  for (const pill of pills) {
    const group = groups.find((g) => overlap(g.anchor, pill));
    if (group) group.ids.push(pill.id);
    else groups.push({ anchor: pill, ids: [pill.id] });
  }
  return groups.map((g) => g.ids);
}

/** One key per group, the same however the map moved: a kept marker keeps its focus. */
export const groupKey = (ids: readonly string[]): string =>
  [...ids].sort().join('|');

/** Width of a pill before it is drawn: about 8 px a character, plus padding. */
export const estimateWidth = (text: string): number =>
  Math.max(PILL_HEIGHT, text.length * 8 + 26);

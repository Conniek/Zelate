import { describe, expect, it } from 'vitest';
import { estimateWidth, groupKey, groupOverlapping } from './map-groups';

const pill = (id: string, x: number, y = 0, width = 60) => ({
  id,
  x,
  y,
  width,
});

describe('groupOverlapping (F-C1 map)', () => {
  it('keeps pills that do not touch on their own', () => {
    expect(groupOverlapping([pill('a', 0), pill('b', 200)])).toEqual([
      ['a'],
      ['b'],
    ]);
  });

  it('groups overlapping pills around the nearest salon first', () => {
    expect(
      groupOverlapping([
        pill('near', 100, 100),
        pill('b', 130, 110),
        pill('c', 90, 140),
        pill('far', 400, 100),
      ]),
    ).toEqual([['near', 'b', 'c'], ['far']]);
  });

  it('a group stays on its first salon, so it never covers the next pill', () => {
    // A and B overlap; C, 68 px from A, does not: it stays alone.
    expect(
      groupOverlapping([pill('a', 0), pill('b', 56), pill('c', 69)]),
    ).toEqual([['a', 'b'], ['c']]);
  });

  it('wide pills group sooner than small ones', () => {
    const wide = estimateWidth("Complet aujourd'hui");
    expect(
      groupOverlapping([pill('a', 0, 0, wide), pill('b', wide - 20, 0, wide)]),
    ).toEqual([['a', 'b']]);
    expect(groupOverlapping([pill('a', 0), pill('b', 80)])).toEqual([
      ['a'],
      ['b'],
    ]);
  });

  it('names a group the same whatever the order', () => {
    expect(groupKey(['b', 'a'])).toBe(groupKey(['a', 'b']));
  });
});

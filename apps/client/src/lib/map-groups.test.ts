import { describe, expect, it } from 'vitest';
import { groupByDistance, groupKey } from './map-groups';

describe('groupByDistance (F-C1 map)', () => {
  it('keeps salons far apart on their own', () => {
    expect(
      groupByDistance(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 200, y: 0 },
        ],
        60,
      ),
    ).toEqual([['a'], ['b']]);
  });

  it('groups salons whose pills would overlap, around the nearest first', () => {
    expect(
      groupByDistance(
        [
          { id: 'near', x: 100, y: 100 },
          { id: 'b', x: 130, y: 110 },
          { id: 'c', x: 90, y: 140 },
          { id: 'far', x: 400, y: 100 },
        ],
        60,
      ),
    ).toEqual([['near', 'b', 'c'], ['far']]);
  });

  it('names a group the same whatever the order', () => {
    expect(groupKey(['b', 'a'])).toBe(groupKey(['a', 'b']));
  });
});

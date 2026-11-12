import { describe, expect, it } from 'vitest';

import { positionFor, reorder, stepPosition } from './arrange';

const ids = ['a', 'b', 'c', 'd'];

describe('positionFor', () => {
  it('places an item moved down after the item now in its place', () => {
    expect(positionFor(ids, 0, 2)).toEqual({ afterId: 'c' });
    expect(positionFor(ids, 1, 3)).toEqual({ afterId: 'd' });
  });

  it('places an item moved up before the item now in its place', () => {
    expect(positionFor(ids, 3, 0)).toEqual({ beforeId: 'a' });
    expect(positionFor(ids, 2, 1)).toEqual({ beforeId: 'b' });
  });

  it('saves nothing when it lands where it started or out of range', () => {
    expect(positionFor(ids, 1, 1)).toBeNull();
    expect(positionFor(ids, -1, 1)).toBeNull();
    expect(positionFor(ids, 1, 9)).toBeNull();
  });
});

describe('stepPosition', () => {
  it('moves one place up or down, and not past the ends', () => {
    expect(stepPosition(ids, 1, -1)).toEqual({ beforeId: 'a' });
    expect(stepPosition(ids, 1, 1)).toEqual({ afterId: 'c' });
    expect(stepPosition(ids, 0, -1)).toBeNull();
    expect(stepPosition(ids, 3, 1)).toBeNull();
  });
});

describe('reorder', () => {
  it('returns the new order', () => {
    expect(reorder(ids, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});

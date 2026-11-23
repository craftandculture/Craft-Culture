import { describe, expect, it } from 'vitest';

import startingLayerBottles from './startingLayerBottles';

const layers = [
  { id: 'old', docDate: '2025-12-02', docRef: 'INV-000168', bottles: 24, opening: 0 },
  { id: 'mid', docDate: '2026-02-16', docRef: 'INV-000212', bottles: 12, opening: 1 },
  { id: 'outright', docDate: '2026-03-01', docRef: 'INV-000221', bottles: 6, opening: null },
  { id: 'new', docDate: '2026-10-08', docRef: 'INV-000402', bottles: 6, opening: null },
];

describe('startingLayerBottles', () => {
  it('starts counted lines from the opening and others full', () => {
    const left = startingLayerBottles(layers, []);

    expect([...left.values()]).toEqual([0, 1, 6, 6]);
  });

  it('takes sales up to the opening off uncounted lines only', () => {
    const left = startingLayerBottles(layers, [{ bottles: 4, afterOpening: false }]);

    expect(left.get('mid')).toBe(1);
    expect(left.get('outright')).toBe(2);
  });

  it('takes later sales off the oldest line with bottles', () => {
    const left = startingLayerBottles(layers, [{ bottles: 3, afterOpening: true }]);

    expect(left.get('mid')).toBe(0);
    expect(left.get('outright')).toBe(4);
    expect(left.get('new')).toBe(6);
  });
});

import { describe, expect, it } from 'vitest';

import assessReorder from './assessReorder';

describe('assessReorder', () => {
  it('flags a fast seller as low while bottles remain', () => {
    const result = assessReorder({ held: 2, inTransit: 0, sold30: 12, sold90: 30, pack: 6 });
    expect(result.status).toBe('low');
    expect(result.daysCover).toBe(5);
    // 0.4/day × 30 = 12, less 2 held = 10 → 2 cases of 6
    expect(result.suggestCases).toBe(2);
    expect(result.suggestBottles).toBe(12);
  });

  it('leaves a slow seller with little stock alone', () => {
    const result = assessReorder({ held: 2, inTransit: 0, sold30: 1, sold90: 3, pack: 6 });
    expect(result.status).toBeNull();
    expect(result.daysCover).toBe(60);
  });

  it('counts stock already on its way to them', () => {
    const result = assessReorder({ held: 1, inTransit: 12, sold30: 12, sold90: 36, pack: 6 });
    expect(result.status).toBeNull();
  });

  it('calls an empty shelf out of stock when it sold recently', () => {
    const result = assessReorder({ held: 0, inTransit: 0, sold30: 0, sold90: 4, pack: 6 });
    expect(result.status).toBe('oos');
    expect(result.suggestCases).toBe(1);
  });

  it('is out of stock even with bottles in transit, since the shelf is empty', () => {
    const result = assessReorder({ held: 0, inTransit: 6, sold30: 6, sold90: 12, pack: 6 });
    expect(result.status).toBe('oos');
  });

  it('ignores an empty shelf of a wine nobody has bought in 90 days', () => {
    const result = assessReorder({ held: 0, inTransit: 0, sold30: 0, sold90: 0, pack: 6 });
    expect(result.status).toBeNull();
  });

  it('suggests single bottles for a single-bottle pack', () => {
    const result = assessReorder({ held: 0, inTransit: 0, sold30: 3, sold90: 5, pack: 1 });
    expect(result.status).toBe('oos');
    expect(result.suggestBottles).toBe(3);
  });
});

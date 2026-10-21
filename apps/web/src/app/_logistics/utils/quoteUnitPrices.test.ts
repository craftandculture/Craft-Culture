import { describe, expect, it } from 'vitest';

import item75clEquivalents from './item75clEquivalents';
import quoteUnitPrices from './quoteUnitPrices';

describe('quoteUnitPrices', () => {
  it('prices per bottle and per 75cl equivalent', () => {
    expect(quoteUnitPrices(2140, 993, 1111.3)).toEqual({ perBottleUsd: 2.16, per75clUsd: 1.93 });
  });

  it('returns null rather than dividing by a missing count', () => {
    expect(quoteUnitPrices(2140, null, 0)).toEqual({ perBottleUsd: null, per75clUsd: null });
    expect(quoteUnitPrices(null, 993, 1111.3)).toEqual({ perBottleUsd: null, per75clUsd: null });
  });
});

describe('item75clEquivalents', () => {
  it('counts a magnum as two and a half bottle as one half', () => {
    expect(item75clEquivalents({ totalBottles: 6, cases: 1, bottlesPerCase: 6, bottleSizeMl: 1500 })).toBe(12);
    expect(item75clEquivalents({ totalBottles: null, cases: 2, bottlesPerCase: 12, bottleSizeMl: 375 })).toBe(12);
  });

  it('takes a case as 12 bottles of 75cl when the pack is unknown', () => {
    expect(item75clEquivalents({ totalBottles: null, cases: 3, bottlesPerCase: null, bottleSizeMl: null })).toBe(36);
  });
});

import { describe, expect, it } from 'vitest';

import requestUnitCounts from './requestUnitCounts';

describe('requestUnitCounts', () => {
  it("uses the request's own counts when it has them", () => {
    expect(
      requestUnitCounts({ totalBottles: 600, total75clEquivalents: 650 }, 1188),
    ).toEqual({ bottles: 600, equivalents: 650, bottlesFrom: 'request' });
  });

  it("falls back to the shipment's bottles, without a 75cl figure", () => {
    expect(
      requestUnitCounts({ totalBottles: null, total75clEquivalents: null }, 1188),
    ).toEqual({ bottles: 1188, equivalents: null, bottlesFrom: 'shipment' });
  });

  it('has no bottle count when neither holds one', () => {
    expect(
      requestUnitCounts({ totalBottles: 0, total75clEquivalents: null }, 0),
    ).toEqual({ bottles: null, equivalents: null, bottlesFrom: null });
  });
});

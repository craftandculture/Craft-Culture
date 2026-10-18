import { describe, expect, it } from 'vitest';

import ukMoveTotal from './ukMoveTotal';

describe('ukMoveTotal', () => {
  it("adds 30% to LCB's charges only", () => {
    expect(ukMoveTotal({ freightUsd: 900, lcbChargesUsd: 60, otherUsd: 0 })).toEqual({
      lcbChargedUsd: 78,
      totalUsd: 978,
    });
  });

  it('passes freight and other charges through at cost', () => {
    expect(ukMoveTotal({ freightUsd: 900, lcbChargesUsd: 0, otherUsd: 50 })).toEqual({
      lcbChargedUsd: 0,
      totalUsd: 950,
    });
  });

  it('rounds to the cent', () => {
    expect(ukMoveTotal({ freightUsd: 0, lcbChargesUsd: 33.33, otherUsd: 0 })).toEqual({
      lcbChargedUsd: 43.33,
      totalUsd: 43.33,
    });
  });
});

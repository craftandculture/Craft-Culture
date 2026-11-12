import { describe, expect, it } from 'vitest';

import { casesToKeepOnRelease, spareHeldBottles } from './planSharedHold';

describe('spareHeldBottles', () => {
  it('counts the unused bottles of a case held for one bottle', () => {
    expect(spareHeldBottles([{ quantityCases: 1, quantityBottles: 1 }], 6)).toBe(5);
  });

  it('nets off orders already sharing the case', () => {
    const holds = [
      { quantityCases: 1, quantityBottles: 1 },
      { quantityCases: 0, quantityBottles: 2 },
    ];

    expect(spareHeldBottles(holds, 6)).toBe(3);
  });

  it('finds nothing spare in whole-case holds', () => {
    expect(spareHeldBottles([{ quantityCases: 3, quantityBottles: null }], 12)).toBe(0);
  });
});

describe('casesToKeepOnRelease', () => {
  it('keeps the shared case when its holder is released', () => {
    expect(casesToKeepOnRelease([{ quantityCases: 0, quantityBottles: 1 }], 6, 1)).toBe(1);
  });

  it('gives the case back when nobody else needs it', () => {
    expect(casesToKeepOnRelease([{ quantityCases: 2, quantityBottles: null }], 6, 1)).toBe(0);
  });

  it('keeps enough cases for every bottle still promised', () => {
    const holds = [
      { quantityCases: 0, quantityBottles: 4 },
      { quantityCases: 0, quantityBottles: 4 },
    ];

    expect(casesToKeepOnRelease(holds, 6, 3)).toBe(2);
  });

  it('never keeps more than the released hold had', () => {
    expect(casesToKeepOnRelease([{ quantityCases: 0, quantityBottles: 20 }], 6, 1)).toBe(1);
  });
});

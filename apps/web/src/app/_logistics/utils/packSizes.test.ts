import { describe, expect, it } from 'vitest';

import findBilledBottleGaps from './findBilledBottleGaps';
import groupSameWineOrder from './groupSameWineOrder';
import parseCaseMix from './parseCaseMix';
import splitLineAmounts from './splitLineAmounts';
import wineGroupKey from './wineGroupKey';
import withLwinPack from './withLwinPack';

const line = (
  id: string,
  over: Partial<Parameters<typeof findBilledBottleGaps>[0][number]> = {},
) => ({
  id,
  productName: id,
  lwin: null,
  supplierSku: null,
  vintage: 2023,
  bottleSizeMl: 750,
  cases: 1,
  bottlesPerCase: 6,
  totalBottles: 6,
  sourceTotal: null,
  sourceUnitPrice: null,
  ...over,
});

describe('withLwinPack', () => {
  it('changes only the pack digits', () => {
    expect(withLwinPack('1063145-2022-03-00750', 6)).toBe('1063145-2022-06-00750');
    expect(withLwinPack('106314520220300750', 12)).toBe('1063145-2022-12-00750');
  });

  it('leaves anything that is not a LWIN18 alone', () => {
    expect(withLwinPack(null, 6)).toBeNull();
    expect(withLwinPack('1063145', 6)).toBe('1063145');
  });
});

describe('wineGroupKey', () => {
  it('treats every pack of one wine as the same wine', () => {
    expect(wineGroupKey(line('a', { lwin: '9000012-2023-03-00750' }))).toBe(
      wineGroupKey(line('b', { lwin: '9000012-2023-06-00750' })),
    );
  });

  it('keeps vintages and bottle sizes apart', () => {
    expect(wineGroupKey(line('a', { lwin: '9000012-2023-06-00750' }))).not.toBe(
      wineGroupKey(line('b', { lwin: '9000012-2022-06-00750' })),
    );
    expect(wineGroupKey(line('a', { lwin: '9000012-2023-06-00750' }))).not.toBe(
      wineGroupKey(line('b', { lwin: '9000012-2023-06-01500' })),
    );
  });
});

describe('splitLineAmounts', () => {
  it('divides by bottles and adds back to the cent', () => {
    const amounts = {
      sourceTotal: 819,
      declaredValueUsd: 955.51,
      grossWeightKg: 30,
      netWeightKg: 15.75,
      freightAllocated: null,
      handlingAllocated: null,
      govFeesAllocated: null,
      insuranceAllocated: null,
      landedCostTotal: null,
    };
    const { keep, add } = splitLineAmounts(amounts, 18, 3);

    expect(add.sourceTotal).toBe(117);
    expect(keep.sourceTotal).toBe(702);
    expect((keep.declaredValueUsd ?? 0) + (add.declaredValueUsd ?? 0)).toBeCloseTo(955.51, 2);
    expect(add.freightAllocated).toBeNull();
  });
});

describe('findBilledBottleGaps', () => {
  it('flags a wine whose pack sizes fall short of what was billed', () => {
    // Cyprien Arlaud: 45 billed at 13.25, entered as 1 x 3 + 6 x 6 = 39
    const gaps = findBilledBottleGaps([
      line('a3', { lwin: '9000012-2023-03-00750', bottlesPerCase: 3, totalBottles: 3, sourceTotal: 596.25, sourceUnitPrice: 13.25 }),
      line('a6', { lwin: '9000012-2023-06-00750', cases: 6, totalBottles: 36 }),
    ]);

    expect([...gaps.values()]).toEqual([{ itemIds: ['a3', 'a6'], billed: 45, onLines: 39 }]);
  });

  it('is quiet once the packs add up, across both lines', () => {
    const gaps = findBilledBottleGaps([
      line('m6', { lwin: '1063145-2022-06-00750', cases: 3, totalBottles: 18, sourceTotal: 702, sourceUnitPrice: 39 }),
      line('m3', { lwin: '1063145-2022-03-00750', bottlesPerCase: 3, totalBottles: 3, sourceTotal: 117, sourceUnitPrice: 39 }),
    ]);

    expect(gaps.size).toBe(0);
  });

  it('does not check a wine with nothing billed to compare', () => {
    expect(findBilledBottleGaps([line('x')]).size).toBe(0);
  });
});

describe('groupSameWineOrder', () => {
  it('pulls a wine together at its first appearance and keeps the rest in order', () => {
    const order = groupSameWineOrder([
      line('arlaud3', { lwin: '9000012-2023-03-00750' }),
      line('vilmart', { lwin: '1213292-0000-06-00750' }),
      line('montille', { lwin: '1063145-2022-03-00750' }),
      line('arlaud6', { lwin: '9000012-2023-06-00750' }),
    ]);

    expect(order).toEqual(['arlaud3', 'arlaud6', 'vilmart', 'montille']);
  });
});

describe('splitLineAmounts on a full row', () => {
  it('returns only the amount fields, never the row id', () => {
    const row = {
      id: 'row-1',
      productName: 'x',
      sourceTotal: 30,
      declaredValueUsd: null,
      grossWeightKg: null,
      netWeightKg: null,
      freightAllocated: null,
      handlingAllocated: null,
      govFeesAllocated: null,
      insuranceAllocated: null,
      landedCostTotal: null,
    };
    const { keep, add } = splitLineAmounts(row, 3, 3);

    expect('id' in add).toBe(false);
    expect('productName' in keep).toBe(false);
    expect(add.sourceTotal).toBe(15);
  });
});

describe('parseCaseMix', () => {
  it('reads a Vinlock mixed-pack cell', () => {
    expect(parseCaseMix('7x6 + 1x3')).toEqual([
      { cases: 7, bottlesPerCase: 6 },
      { cases: 1, bottlesPerCase: 3 },
    ]);
    expect(parseCaseMix('3 × 6+1x2')).toEqual([
      { cases: 3, bottlesPerCase: 6 },
      { cases: 1, bottlesPerCase: 2 },
    ]);
  });

  it('leaves a plain pack and anything unreadable alone', () => {
    expect(parseCaseMix('6')).toBeNull();
    expect(parseCaseMix('6x75cl')).toBeNull();
    expect(parseCaseMix('7x6 + some')).toBeNull();
    expect(parseCaseMix(undefined)).toBeNull();
  });
});

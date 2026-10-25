import { describe, expect, it } from 'vitest';

import planDispatchMovements from './planDispatchMovements';

const pick = {
  orderId: 'o1',
  lwin18: '1066306-2023-12-00750',
  productName: 'Dancer Bourgogne Blanc',
  quantityCases: 2,
  quantityBottles: 24,
  fromOwnerId: 'crurated',
  stockId: 's1',
};

describe('planDispatchMovements', () => {
  it('dispatches what was picked, with its owner and stock row', () => {
    const out = planDispatchMovements({ orderIds: ['o1'], picks: [pick], lines: [] });
    expect(out).toEqual([{ ...pick }]);
  });

  it('keeps two owners apart when one line was picked from both', () => {
    const out = planDispatchMovements({
      orderIds: ['o1'],
      picks: [pick, { ...pick, fromOwnerId: 'ihab', stockId: 's2', quantityCases: 1, quantityBottles: 12 }],
      lines: [],
    });
    expect(out.map((m) => m.fromOwnerId)).toEqual(['crurated', 'ihab']);
  });

  it('falls back to an order line only when that wine was not picked', () => {
    const out = planDispatchMovements({
      orderIds: ['o1', 'o2'],
      picks: [pick],
      lines: [
        { orderId: 'o1', lwin18: '1066306-2023-06-00750', productName: 'x', quantity: 4 },
        { orderId: 'o1', lwin18: '1828577-2022-03-00750', productName: 'Montille', quantity: 1 },
        { orderId: 'o2', lwin18: '1032361-2023-12-00750', productName: 'Fourrier', quantity: 3 },
      ],
    });
    expect(out).toHaveLength(3);
    expect(out.slice(1).map((m) => m.lwin18)).toEqual(['1828577-2022-03-00750', '1032361-2023-12-00750']);
    expect(out[2]).toMatchObject({ orderId: 'o2', quantityCases: 3, fromOwnerId: null });
  });

  it('ignores picks from a pick list deleted and picked again', () => {
    const out = planDispatchMovements({
      orderIds: ['o1'],
      picks: [
        { ...pick, performedAt: new Date('2026-10-01') },
        { ...pick, stockId: 's9', performedAt: new Date('2026-10-05') },
      ],
      lines: [],
      pickListCreatedAt: new Map([['o1', new Date('2026-10-03')]]),
    });
    expect(out.map((m) => m.stockId)).toEqual(['s9']);
  });

  it('ignores picks for orders outside the batch and empty picks', () => {
    const out = planDispatchMovements({
      orderIds: ['o1'],
      picks: [{ ...pick, orderId: 'other' }, { ...pick, quantityCases: 0, quantityBottles: 0 }],
      lines: [],
    });
    expect(out).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import applyOpeningPosition from './applyOpeningPosition';

const layer = (
  id: string,
  docRef: string,
  docDate: string,
  lwin18: string,
  productName: string,
  bottles: number,
) => ({
  id,
  arrangementId: 'crurated',
  lwin18,
  productName,
  docRef,
  docDate,
  bottles,
  invoiceType: 'consignment' as const,
});

const layers = [
  layer('a', 'INV-000168', '2026-01-10', '1001001-2019-06-00750', 'Chateau Talbot 2019', 12),
  layer('b', 'INV-000212', '2026-03-01', '1001001-2019-06-00750', 'Chateau Talbot 2019', 12),
  layer('c', 'INV-000212', '2026-03-01', '1002002-2020-06-00750', 'Montille Chassagne 2020', 6),
  layer('d', 'INV-000400', '2026-10-05', '1001001-2019-06-00750', 'Chateau Talbot 2019', 6),
  layer('e', 'INV-000197', '2026-02-01', '1003003-2018-06-00750', 'Elio Grasso Barolo 2018', 6),
];

const keyOfCode = (code: string) =>
  code === 'CDR1' ? '1001001201900750' : null;

describe('applyOpeningPosition', () => {
  it('sets every line of a covered invoice, zero where nothing was left', () => {
    const result = applyOpeningPosition(
      layers,
      [
        { docRef: 'INV-000168', outletCode: 'CDR1', wineName: 'Talbot 2019', leftBottles: 0 },
        { docRef: 'INV-000212', outletCode: 'CDR1', wineName: 'Talbot 2019', leftBottles: 4 },
      ],
      keyOfCode,
      '2026-09-30',
    );

    expect(result.available.get('a')).toBe(0);
    expect(result.available.get('b')).toBe(4);
    expect(result.available.get('c')).toBe(0);
  });

  it('leaves invoices after the opening and invoices it never mentions alone', () => {
    const result = applyOpeningPosition(
      layers,
      [{ docRef: 'INV-000212', outletCode: 'CDR1', wineName: 'Talbot', leftBottles: 4 }],
      keyOfCode,
      '2026-09-30',
    );

    expect(result.available.has('d')).toBe(false);
    expect(result.available.has('e')).toBe(false);
  });

  it('finds a row with no code by its wine name on the invoice', () => {
    const result = applyOpeningPosition(
      layers,
      [{ docRef: 'INV-000212', outletCode: null, wineName: 'Montille Chassagne 2020', leftBottles: 5 }],
      keyOfCode,
      '2026-09-30',
    );

    expect(result.available.get('c')).toBe(5);
    expect(result.unplaced).toHaveLength(0);
  });

  it('reports rows it cannot place and bottles beyond the line', () => {
    const result = applyOpeningPosition(
      layers,
      [
        { docRef: 'INV-000212', outletCode: null, wineName: 'Sassicaia 2020', leftBottles: 2 },
        { docRef: 'INV-000212', outletCode: 'CDR1', wineName: 'Talbot', leftBottles: 15 },
      ],
      keyOfCode,
      '2026-09-30',
    );

    expect(result.available.get('b')).toBe(12);
    expect(result.unplaced.map((row) => row.leftBottles)).toEqual([2, 3]);
  });
});

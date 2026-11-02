import { describe, expect, it } from 'vitest';

import allocateSale from './allocateSale';
import type { SaleLayer } from './allocateSale';

const layer = (overrides: Partial<SaleLayer>): SaleLayer => ({
  arrangementId: 'cc',
  lwin18: '1095391-2022-06-00750',
  productName: 'Tignanello 2022',
  docRef: 'INV-000300',
  docDate: '2026-08-01',
  bottles: 6,
  invoiceType: 'consignment',
  ...overrides,
});

describe('allocateSale', () => {
  it('takes a single owner’s bottles from its lines', () => {
    expect(allocateSale([layer({})], 4, new Map(), null)).toEqual([
      expect.objectContaining({ arrangementId: 'cc', bottles: 4, short: false }),
    ]);
  });

  /* What the outlet paid for is what it sells first */
  it('draws prepaid and outright stock before consignment', () => {
    const shares = allocateSale(
      [
        layer({ docRef: 'INV-000250', docDate: '2026-06-01' }),
        layer({
          arrangementId: 'own',
          docRef: 'INV-000311',
          docDate: '2026-09-01',
          invoiceType: 'outright',
          bottles: 11,
        }),
      ],
      14,
      new Map(),
      null,
    );

    expect(shares).toEqual([
      expect.objectContaining({ arrangementId: 'own', bottles: 11 }),
      expect.objectContaining({ arrangementId: 'cc', bottles: 3 }),
    ]);
  });

  it('starts where earlier months finished', () => {
    const shares = allocateSale(
      [
        layer({ docRef: 'INV-000197', invoiceType: 'prepaid', arrangementId: 'cru', bottles: 6 }),
        layer({ docRef: 'INV-000277', arrangementId: 'cru', bottles: 12 }),
      ],
      4,
      new Map([['cru', 5]]),
      null,
    );

    // One prepaid bottle left, then three from the consignment line
    expect(shares).toEqual([
      expect.objectContaining({ arrangementId: 'cru', bottles: 4, short: false }),
    ]);
  });

  it('keeps bottles beyond every line, marked short', () => {
    const shares = allocateSale([layer({ bottles: 6 })], 9, new Map(), null);

    expect(shares).toEqual([
      expect.objectContaining({ bottles: 6, short: false }),
      expect.objectContaining({ arrangementId: 'cc', bottles: 3, short: true }),
    ]);
  });

  /* Bottles Cru sold never drew down City Drinks' own stock */
  it('counts earlier months per owner', () => {
    const shares = allocateSale(
      [
        layer({ arrangementId: 'own', invoiceType: 'outright', bottles: 6 }),
        layer({ arrangementId: 'cc', docRef: 'INV-000310', bottles: 6 }),
      ],
      3,
      new Map([['cc', 6]]),
      null,
    );

    expect(shares).toEqual([
      expect.objectContaining({ arrangementId: 'own', bottles: 3, short: false }),
    ]);
  });

  it('sends short bottles to the owner the register names', () => {
    const shares = allocateSale([], 2, new Map(), 'rare');

    expect(shares).toEqual([
      expect.objectContaining({ arrangementId: 'rare', bottles: 2, short: true }),
    ]);
  });
});

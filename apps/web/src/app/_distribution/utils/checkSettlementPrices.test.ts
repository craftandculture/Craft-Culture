import { describe, expect, it } from 'vitest';

import checkSettlementPrices from './checkSettlementPrices';
import type { PricedLine } from './checkSettlementPrices';

const line = (overrides: Partial<PricedLine>): PricedLine => ({
  key: '1234567202200750',
  outletCode: 'CDR3846069263',
  productName: 'Montille Chassagne 2022',
  ownerName: 'Crurated',
  docRef: 'INV-000329',
  pricePerBottle: 66.01,
  ownerCostPerBottle: 55.82,
  payOwner: true,
  ...overrides,
});

const recent = [
  { lwin18: '1234567-2022-06-00750', productName: 'Montille', docRef: 'INV-000300', docDate: '2026-09-10', perBottle: 80 },
];

describe('checkSettlementPrices', () => {
  it('flags a price more than 2% from the last three months', () => {
    expect(checkSettlementPrices([line({})], recent)[0]?.detail).toMatch(/from \$80\.00 on INV-000300/);
  });

  it('lets a price within 2% through', () => {
    expect(checkSettlementPrices([line({ pricePerBottle: 79 })], recent)).toEqual([]);
  });

  it('flags billing below what the owner is paid', () => {
    expect(
      checkSettlementPrices([line({ pricePerBottle: 50, ownerCostPerBottle: 76.77 })], [])[0]?.detail,
    ).toMatch(/below the \$76\.77 paid to Crurated/);
  });

  it('never compares C&C’s own wine with an owner cost', () => {
    expect(
      checkSettlementPrices([line({ pricePerBottle: 50, ownerCostPerBottle: 76.77, payOwner: false })], []),
    ).toEqual([]);
  });
});

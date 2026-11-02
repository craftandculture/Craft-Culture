import { describe, expect, it } from 'vitest';

import matchCostRows from './matchCostRows';
import type { OwnerCostRow } from './parseCruratedReconSheet';

const row = (overrides: Partial<OwnerCostRow>): OwnerCostRow => ({
  wCode: null,
  productName: 'Guidalberto, Tenuta San Guido, Toscana',
  vintage: 2020,
  costPerBottle: 37.12,
  tab: 'Jan_2026_Arrival',
  ...overrides,
});

const CANDIDATES = [
  { lwin18: '1234567-2020-06-00750', productName: 'Guidalberto, Tenuta San Guido, Toscana 2020' },
  { lwin18: '1234567-2021-06-00750', productName: 'Guidalberto, Tenuta San Guido, Toscana 2021' },
  { lwin18: '7777777-2020-06-00750', productName: 'Elio Grasso, Barolo, Ginestra Casa Mate 2020' },
];

describe('matchCostRows', () => {
  it('takes the code where the sheet has one', () => {
    const [matched] = matchCostRows(
      [row({ wCode: 'W11600324', productName: 'Lafouge Macabrée 2022' })],
      [],
      new Map([['W11600324', '1160032-2022-06-00750']]),
    );

    expect(matched?.wineKey).toBe('1160032202200750');
    expect(matched?.matchedBy).toBe('code W11600324');
  });

  /* Guidalberto is $37.12 in 2020 and $46.11 in 2021: the vintage decides */
  it('matches name and vintage, never the name alone', () => {
    const [matched] = matchCostRows([row({})], CANDIDATES, new Map());

    expect(matched?.lwin18).toBe('1234567-2020-06-00750');
  });

  it('leaves a row with no clear match unmatched', () => {
    const [matched] = matchCostRows(
      [row({ productName: 'Ornellaia', vintage: 2019 })],
      CANDIDATES,
      new Map(),
    );

    expect(matched?.wineKey).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import type { SaleLayer } from './allocateSale';
import matchSaleLine from './matchSaleLine';
import type { MatchContext } from './matchSaleLine';

const SAN_POLO: SaleLayer = {
  arrangementId: 'a-crurated',
  lwin18: '1234567-2019-03-00750',
  productName: 'San Polo Brunello di Montalcino DOCG 2019',
  docRef: 'INV-000176',
  docDate: '2025-12-17',
  bottles: 6,
  invoiceType: 'consignment',
};

const CERVARO: SaleLayer = {
  arrangementId: 'a-ps',
  lwin18: '7654321-2020-06-00750',
  productName: 'Castello della Sala Cervaro 2020',
  docRef: 'INV-000399',
  docDate: '2026-10-10',
  bottles: 6,
  invoiceType: 'consignment',
};

const context = (overrides: Partial<MatchContext> = {}): MatchContext => ({
  bridge: new Map(),
  layers: [SAN_POLO, CERVARO],
  register: [],
  arrangementByOwner: new Map([
    ['crurated', 'a-crurated'],
    ['ps', 'a-ps'],
  ]),
  ownerOfArrangement: new Map([
    ['a-crurated', 'crurated'],
    ['a-ps', 'ps'],
  ]),
  ...overrides,
});

describe('matchSaleLine', () => {
  it('follows the code to its lines, whatever the pack', () => {
    const match = matchSaleLine(
      { outletCode: 'CDR8413460587', productName: 'San Polo 2019' },
      context({ bridge: new Map([['CDR8413460587', '123456720190600750']]) }),
    );

    expect(match).toMatchObject({ matched: true, via: 'code' });
    expect(match.matched && match.layers).toEqual([SAN_POLO]);
  });

  /* San Polo had sold out and dropped off the feed; the register still knows */
  it('finds the line through the Codes tab when the code is in no feed', () => {
    const match = matchSaleLine(
      { outletCode: 'CDR8413460587', productName: 'San Polo Brunello' },
      context({
        register: [
          {
            outletCode: 'CDR8413460587',
            docRef: 'INV-000176',
            wineName: 'San Polo Brunello di Montalcino 2019',
            ownerId: 'crurated',
            ownerName: 'Crurated',
          },
        ],
      }),
    );

    expect(match).toMatchObject({
      matched: true,
      via: 'Codes tab (INV-000176)',
      shortTo: 'a-crurated',
    });
  });

  it('only suggests a match found by name', () => {
    const match = matchSaleLine(
      {
        outletCode: 'CDR0042961099',
        productName: 'Antinori Castello della Sala Cervaro 2020',
      },
      context(),
    );

    expect(match).toMatchObject({
      matched: false,
      suggestion: { ownerId: 'ps', lwin18: CERVARO.lwin18 },
    });
  });

  it('says why when there is nothing to offer', () => {
    const match = matchSaleLine(
      { outletCode: 'CDR7088364690', productName: 'Thierry Allemand Cornas 2016' },
      context(),
    );

    expect(match).toEqual({
      matched: false,
      reason: 'Code is in no City Drinks feed and not on the Codes tab',
      suggestion: null,
    });
  });

  it('names the register owner even when the wine is not found', () => {
    const match = matchSaleLine(
      { outletCode: 'CDR1', productName: 'Mystery 2001' },
      context({
        register: [
          {
            outletCode: 'CDR1',
            docRef: 'INV-000398',
            wineName: 'Ramonet Montrachet 2001',
            ownerId: 'ps',
            ownerName: 'Rare',
          },
        ],
      }),
    );

    expect(match).toMatchObject({
      matched: false,
      suggestion: { ownerId: 'ps', lwin18: null },
    });
  });
});

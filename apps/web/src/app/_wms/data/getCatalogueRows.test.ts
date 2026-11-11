import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Results handed to each awaited query, in order */
const queued: unknown[][] = [];

/**
 * A stand-in for the Drizzle client: every builder call chains, and awaiting a
 * chain resolves to the next queued result. Only the rows the database would
 * return are faked; everything the catalogue does with them is real.
 */
const chain = (): unknown =>
  new Proxy(() => undefined, {
    get: (_target, prop) => {
      if (prop === 'then') {
        return (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve(queued.shift() ?? []).then(resolve, reject);
      }

      return () => chain();
    },
    apply: () => chain(),
  });

vi.mock('@/database/client', () => ({
  default: chain(),
  client: chain(),
}));

vi.mock('../utils/ownerPricingReady', () => ({
  default: async () => true,
}));

const { default: getCatalogueRows } = await import('./getCatalogueRows');

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One `(wine, owner)` group as the catalogue query returns it */
const ownerRow = (overrides: Record<string, unknown>) => ({
  lwin18: '1013544-2020-06-00750',
  ownerId: 'owner-cc',
  lotProductCost: 500,
  lotLandedCost: 520,
  lotOwnLine: true,
  category: 'Wine',
  lineCategory: 'Wine',
  isCraftCulture: 1,
  isZeroTransferOwner: 0,
  importPricePerBottle: null,
  costOverridePerBottle: null,
  lineLogistics: null,
  transferPricePerBottle: null,
  sellingPricePerBottle: null,
  sellMarginPct: null,
  b2bMarginPct: null,
  pcMarginPct: null,
  ownerLogistics: null,
  ownerInbondPct: null,
  ownerPcPct: null,
  mandateAsk: null,
  product: 'Chateau Mouton Rothschild',
  producer: 'Chateau Mouton Rothschild',
  vintage: 2020,
  owner: 'Craft & Culture',
  caseConfig: 6,
  bottleSize: '75cl',
  availableCases: 2,
  ...overrides,
});

describe('getCatalogueRows', () => {
  beforeEach(() => {
    queued.length = 0;
  });

  it('lists a wine the Pricing Manager selection leaves out', async () => {
    /*
      Inclusion is the catalogue's own (available, not held, in our
      warehouse); only the price follows the Pricing Manager. A wine whose
      Pricing Manager row is missing — e.g. quantity_cases at 0 while
      available_cases is not, or a row lost between pages — still lists.
    */
    queued.push([ownerRow({})], []);

    const rows = await getCatalogueRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lwin18: '1013544-2020-06-00750',
      availableCases: 2,
      availableBottles: 12,
      ibPerBottle: round2((500 + 20 + 2.5) / 0.9),
      ibPerCase: round2(((500 + 20 + 2.5) / 0.9) * 6),
    });
  });

  it('lists one line per wine: cases summed, the higher owner price', async () => {
    queued.push(
      [
        ownerRow({}),
        ownerRow({
          ownerId: 'owner-crurated',
          isCraftCulture: 0,
          isZeroTransferOwner: 1,
          lotProductCost: 560,
          lotLandedCost: 575,
          availableCases: 3,
        }),
      ],
      [],
    );

    const rows = await getCatalogueRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      availableCases: 5,
      availableBottles: 30,
      ibPerBottle: round2(Math.max(522.5 / 0.9, 575 / 0.9)),
    });
  });
});

import { describe, expect, it } from 'vitest';

import fixture from './cityDrinksStock.fixture.json';
import parseCityDrinksStock from './parseCityDrinksStock';
import type { CityDrinksStockResponse } from './parseCityDrinksStock';

/**
 * The live feed as it stood on 18 September 2026 — 389 products.
 *
 * Kept verbatim rather than reduced, so a change in City Drinks' shape shows
 * up here rather than in a month's figures.
 */
const live = fixture as CityDrinksStockResponse;

describe('parseCityDrinksStock', () => {
  const parsed = parseCityDrinksStock(live);

  it('reads the snapshot moment', () => {
    expect(parsed.takenAt.toISOString()).toBe('2026-09-18T02:00:05.000Z');
  });

  /*
    The feed shows 164 lines as Consigned, but three of them are City Drinks'
    own landed-cost test rows. 161 is the real figure, and the difference is
    worth stating: a count taken straight off the API will not match this one.
  */
  it('splits consignment from their own stock', () => {
    expect(parsed.counts.consigned).toBe(161);
    expect(parsed.counts.bought).toBe(225);
    expect(parsed.counts.consigned + parsed.counts.bought).toBe(386);
  });

  it('counts 1,093 consigned bottles', () => {
    expect(parsed.counts.consignedBottles).toBe(1093);
  });

  it('drops the rows City Drinks test with', () => {
    expect(parsed.counts.excluded).toBe(3);
    expect(parsed.rows.some((row) => row.ourCode?.startsWith('Testing'))).toBe(
      false,
    );
  });

  /*
    Keeping only consignment would make a line moving to bought look like stock
    vanishing, and we would bill its owner for bottles City Drinks had bought.
  */
  it('keeps both regimes, so a purchase is not read as a sale', () => {
    expect(parsed.rows.length).toBe(386);
    expect(parsed.rows.some((row) => row.regime === 'bought')).toBe(true);
  });

  it('lists consigned wines with no code of ours rather than dropping them', () => {
    expect(parsed.unmatched).toHaveLength(4);
    expect(parsed.unmatched.map((row) => row.productName)).toContain(
      'Tenuta San Guido Sassicaia 2019',
    );
  });

  it('takes our code from their_sku, not their own', () => {
    const crurated = parsed.rows.find((row) => row.ourCode === 'W2104324');

    expect(crurated?.outletCode).toMatch(/^CDR/);
    expect(crurated?.regime).toBe('consigned');
  });

  it('refuses a payload it cannot date', () => {
    expect(() =>
      parseCityDrinksStock({ generated_at: 'soon', products: [] }),
    ).toThrow(/unreadable generated_at/);
  });
});

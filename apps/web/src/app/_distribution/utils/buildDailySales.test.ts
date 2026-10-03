import { describe, expect, it } from 'vitest';

import buildDailySales from './buildDailySales';
import type { PairRow } from './buildDailySales';

const row = (over: Partial<PairRow>): PairRow => ({
  closedAt: '2026-10-03 02:00:00',
  openedAt: '2026-10-02 02:00:00',
  salesDate: '2026-10-02',
  spanHours: 24,
  outletCode: 'CDR1',
  productName: 'Tignanello 2019',
  regime: 'consigned',
  code: '11000012019',
  heldFrom: 12,
  heldTo: 12,
  soldLast30d: 4,
  delivered: 0,
  bottlePrice: 100,
  currency: 'USD',
  ownerName: 'Crurated',
  ...over,
});

describe('buildDailySales', () => {
  it('reads a falling count as a sale, valued at our price', () => {
    const { days } = buildDailySales([row({ heldFrom: 12, heldTo: 9 })]);

    expect(days[0]?.consigned).toEqual({ bottles: 3, value: 300 });
    expect(days[0]?.lines[0]).toMatchObject({ sold: 3, heldAfter: 9, value: 300 });
  });

  it('adds what we delivered in the window before differencing', () => {
    // Held 6, we sent 6, they hold 8: four sold, not a restock of two
    const { days } = buildDailySales([row({ heldFrom: 6, delivered: 6, heldTo: 8 })]);

    expect(days[0]?.consigned.bottles).toBe(4);
    expect(days[0]?.restocks).toEqual([]);
  });

  it('lists a rise beyond our deliveries as a restock, never a negative sale', () => {
    const { days } = buildDailySales([row({ heldFrom: 2, heldTo: 8 })]);

    expect(days[0]?.consigned.bottles).toBe(0);
    expect(days[0]?.lines).toEqual([]);
    expect(days[0]?.restocks).toEqual([{ productName: 'Tignanello 2019', bottles: 6 }]);
  });

  it('keeps consigned and bought apart, consigned first', () => {
    const { days } = buildDailySales([
      row({ outletCode: 'CDR2', regime: 'bought', heldFrom: 10, heldTo: 4 }),
      row({ outletCode: 'CDR1', heldFrom: 3, heldTo: 2 }),
    ]);

    expect(days[0]?.consigned.bottles).toBe(1);
    expect(days[0]?.bought.bottles).toBe(6);
    expect(days[0]?.lines.map((line) => line.regime)).toEqual(['consigned', 'bought']);
  });

  it('counts an unlinked wine as sold but gives it no value', () => {
    const { days, unlinked } = buildDailySales([
      row({ code: null, bottlePrice: null, currency: null, ownerName: null, heldFrom: 5, heldTo: 3 }),
    ]);

    expect(days[0]?.consigned).toEqual({ bottles: 2, value: 0 });
    expect(days[0]?.lines[0]?.value).toBeNull();
    expect(unlinked).toBe(1);
  });

  it('totals only the dominant currency', () => {
    const { days, currency } = buildDailySales([
      row({ outletCode: 'CDR1', heldFrom: 10, heldTo: 0, bottlePrice: 100, currency: 'USD' }),
      row({ outletCode: 'CDR2', heldFrom: 1, heldTo: 0, bottlePrice: 50, currency: 'AED' }),
    ]);

    expect(currency).toBe('USD');
    expect(days[0]?.consigned.value).toBe(1000);
  });

  it('orders days newest first and flags consigned stock with no sale in 30 days', () => {
    const { days, notMoving } = buildDailySales([
      row({ closedAt: '2026-10-02 02:00:00', salesDate: '2026-10-01', heldFrom: 9, heldTo: 8 }),
      row({ outletCode: 'CDR9', productName: 'Sleeper', soldLast30d: 0, heldFrom: 6, heldTo: 6 }),
    ]);

    expect(days.map((day) => day.salesDate)).toEqual(['2026-10-02', '2026-10-01']);
    expect(notMoving).toEqual([{ productName: 'Sleeper', ownerName: 'Crurated', held: 6, category: 'wine' }]);
  });
});

import { describe, expect, it } from 'vitest';

import planOutstandingRelease from './planOutstandingRelease';
import type { OrderLine, PickedLine } from './planOutstandingRelease';

const order = (
  sku: string,
  quantity: number,
  unit = 'Case',
  id = sku,
): OrderLine => ({ id, sku, lwin18: sku, name: sku, unit, quantity });

const picked = (
  lwin18: string,
  quantityCases: number,
  quantityBottles: number | null = null,
  isPicked = true,
): PickedLine => ({ lwin18, quantityCases, quantityBottles, isPicked });

/**
 * SO-00127 as it actually stands: eight lines, all picked, two of them broken
 * out of six-packs and invoiced as three-packs.
 */
const SO_00127_ORDER = [
  order('1012781-2003-12-00750', 2),
  order('1533435-2020-03-00750', 12),
  order('1122981-2016-03-00750', 1),
  order('1314377-2011-03-00750', 1),
  order('1095391-2020-06-00750', 1),
  order('1095391-2016-06-00750', 1),
  order('1081806-2004-03-00750', 1),
  order('1103470-2016-01-00750', 1),
];

const SO_00127_PICKED = [
  picked('1012781-2003-12-00750', 2),
  picked('1533435-2020-03-00750', 12),
  // Picked out of a six-pack, three bottles taken.
  picked('1122981-2016-06-00750', 1, 3),
  picked('1314377-2011-06-00750', 1, 3),
  picked('1095391-2020-06-00750', 1),
  picked('1095391-2016-06-00750', 1),
  picked('1081806-2004-03-00750', 1),
  picked('1103470-2016-01-00750', 1),
];

describe('planOutstandingRelease', () => {
  it('owes nothing on a fully picked order', () => {
    const result = planOutstandingRelease(SO_00127_ORDER, SO_00127_PICKED);

    expect(result.totalOutstandingBottles).toBe(0);
    expect(result.toRelease).toEqual([]);
  });

  it('does not re-pick a line that was broken out of a bigger pack', () => {
    const result = planOutstandingRelease(SO_00127_ORDER, SO_00127_PICKED);

    // Comparing SKUs calls these two untouched, because the pick carries
    // -06- and the invoice -03-. That would send someone to pick six bottles
    // already sitting on the pallet.
    const phelps = result.lines.find((l) => l.line.sku?.startsWith('1122981'));
    expect(phelps?.pickedBottles).toBe(3);
    expect(phelps?.outstandingBottles).toBe(0);
  });

  it('owes only the cases added after the pick was finished', () => {
    const amended = [...SO_00127_ORDER, order('1012781-2003-12-00750', 2, 'Case', 'added')];

    const result = planOutstandingRelease(amended, SO_00127_PICKED);

    // Two 12-packs added to a wine already picked in full.
    expect(result.totalOutstandingBottles).toBe(24);
    expect(result.toRelease).toHaveLength(1);
    expect(result.toRelease[0]?.releaseQuantity).toBe(2);
  });

  it('releases in the unit the line is written in', () => {
    const result = planOutstandingRelease(
      [order('1095391-2020-06-00750', 4, 'Bottle')],
      [],
    );

    expect(result.toRelease[0]?.outstandingBottles).toBe(4);
    expect(result.toRelease[0]?.releaseQuantity).toBe(4);
  });

  it('rounds a part case up rather than shipping short', () => {
    // Six bottles owed on a 12-pack line: one case has to be broken.
    const result = planOutstandingRelease(
      [order('1012781-2003-12-00750', 1)],
      [picked('1012781-2003-12-00750', 1, 6)],
    );

    expect(result.toRelease[0]?.outstandingBottles).toBe(6);
    expect(result.toRelease[0]?.releaseQuantity).toBe(1);
  });

  it('still owes a line that was released but never picked', () => {
    const result = planOutstandingRelease(
      [order('1081806-2004-03-00750', 1)],
      [picked('1081806-2004-03-00750', 1, null, false)],
    );

    // An abandoned pick list must not quietly satisfy the order.
    expect(result.totalOutstandingBottles).toBe(3);
  });

  it('shares one wine across two lines without double counting', () => {
    const result = planOutstandingRelease(
      [
        order('1095391-2020-06-00750', 1, 'Case', 'a'),
        order('1095391-2020-03-00750', 1, 'Case', 'b'),
      ],
      [picked('1095391-2020-06-00750', 1)],
    );

    // Six bottles picked of nine ordered: the first line is satisfied, the
    // second still owes three. Both lines are the same wine.
    expect(result.lines[0]?.outstandingBottles).toBe(0);
    expect(result.lines[1]?.outstandingBottles).toBe(3);
    expect(result.totalOutstandingBottles).toBe(3);
  });

  it('reports stock picked beyond the order rather than writing it back', () => {
    const result = planOutstandingRelease(
      [order('1012781-2003-12-00750', 1)],
      [picked('1012781-2003-12-00750', 2)],
    );

    expect(result.totalOutstandingBottles).toBe(0);
    expect(result.overPicked).toEqual([
      { key: '1012781-2003-00750', bottles: 12 },
    ]);
  });

  it('does not claim a line picked under a different code is owed', () => {
    // SO-00135: the order carries a supplier SKU, the bay an LWIN. One
    // product, two names, no shared key — and the order shipped complete.
    const pickedAt = new Date('2026-09-16T12:00:00Z');
    const result = planOutstandingRelease(
      [
        {
          id: 'sotol',
          sku: 'SOT-CAS-750-BTL-UAE-BLC',
          lwin18: null,
          name: 'CASA LOTOS - Sotol Blanco',
          unit: 'Cases',
          quantity: 20,
          createdAt: new Date('2026-09-15T09:00:00Z'),
        },
      ],
      [picked('SOTCAS750B-0000-06-00700', 4, 20)],
      { lastPickListAt: pickedAt },
    );

    // Reporting twenty bottles owed would send someone to re-pick a delivered
    // order. Withheld, and surfaced as unverifiable instead.
    expect(result.toRelease).toEqual([]);
    expect(result.totalOutstandingBottles).toBe(0);
    expect(result.unverifiable).toHaveLength(1);
  });

  it('does believe a line added after the pick was raised', () => {
    const result = planOutstandingRelease(
      [
        {
          id: 'added',
          sku: 'SOME-SUPPLIER-CODE',
          lwin18: null,
          name: 'Added later',
          unit: 'Cases',
          quantity: 2,
          createdAt: new Date('2026-09-22T08:00:00Z'),
        },
      ],
      [picked('1012781-2003-12-00750', 2)],
      { lastPickListAt: new Date('2026-09-16T12:00:00Z') },
    );

    // New by date, even though its code matches nothing picked.
    expect(result.toRelease).toHaveLength(1);
    expect(result.toRelease[0]?.releaseQuantity).toBe(2);
  });

  it('owes the whole order when nothing has been picked', () => {
    const result = planOutstandingRelease(SO_00127_ORDER, []);

    expect(result.toRelease).toHaveLength(8);
    expect(result.totalOutstandingBottles).toBe(82);
  });

  it('handles a supplier code that is not an LWIN', () => {
    const result = planOutstandingRelease(
      [order('RUMHAM700B-0000-12-00700', 2)],
      [picked('RUMHAM700B-0000-12-00700', 1)],
    );

    expect(result.totalOutstandingBottles).toBe(12);
    expect(result.toRelease[0]?.releaseQuantity).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';

import planLedgerReconcile from './planLedgerReconcile';

/** Built from the wines on the reconcile screen on 17 Aug 2026. */

describe('planLedgerReconcile', () => {
  it('records a pack re-designation as one repack, not two arrivals', () => {
    const plan = planLedgerReconcile([
      {
        lwin18: '1103034-2019-03-00750',
        productName: 'San Polo Brunello di Montalcino',
        diff: 18,
        locationId: 'loc-a',
      },
      {
        lwin18: '1103034-2019-06-00750',
        productName: 'San Polo Brunello di Montalcino',
        diff: -18,
        locationId: null,
      },
    ]);

    expect(plan.repacks).toHaveLength(1);
    expect(plan.repacks[0]?.from.lwin18).toBe('1103034-2019-06-00750');
    expect(plan.repacks[0]?.to.lwin18).toBe('1103034-2019-03-00750');
    expect(plan.repacks[0]?.cases).toBe(18);
    expect(plan.topUps).toHaveLength(0);
    expect(plan.needsCount).toHaveLength(0);
  });

  it('sizes an arrival by the GAP, not by what is left on the shelf', () => {
    // La Parde: the bottles arrived from a cracked case and were then picked,
    // so the row sits at zero with a negative ledger. Recording "stock on hand"
    // would write nothing and the discrepancy would never clear.
    const plan = planLedgerReconcile([
      {
        lwin18: '1013720-2019-01-00750',
        productName: 'La Parde Haut-Bailly (1x)',
        diff: 5,
        locationId: 'loc-c',
      },
      {
        lwin18: '1013720-2019-06-00750',
        productName: 'La Parde Haut-Bailly',
        diff: 0,
        locationId: 'loc-c',
      },
    ]);

    expect(plan.topUps).toHaveLength(1);
    expect(plan.topUps[0]?.cases).toBe(5);
    expect(plan.topUps[0]?.fromCrackedCase).toBe(true);
  });

  it('leaves an under-count for a human to count', () => {
    const plan = planLedgerReconcile([
      {
        lwin18: '1012781-1986-03-00750',
        productName: 'Margaux',
        diff: -4,
        locationId: 'loc-b',
      },
    ]);

    expect(plan.needsCount).toHaveLength(1);
    expect(plan.topUps).toHaveLength(0);
    expect(plan.repacks).toHaveLength(0);
  });

  it('never pairs two different wines, however alike the numbers', () => {
    const plan = planLedgerReconcile([
      {
        lwin18: '1103034-2019-03-00750',
        productName: 'San Polo',
        diff: 18,
        locationId: 'loc-a',
      },
      {
        lwin18: '1105487-2019-06-00750',
        productName: 'Talenti',
        diff: -18,
        locationId: 'loc-b',
      },
    ]);

    expect(plan.repacks).toHaveLength(0);
    expect(plan.topUps).toHaveLength(1);
    expect(plan.needsCount).toHaveLength(1);
  });

  it('will not pair a different vintage or bottle size', () => {
    const plan = planLedgerReconcile([
      {
        lwin18: '1103034-2019-03-00750',
        productName: 'San Polo 2019',
        diff: 6,
        locationId: 'loc-a',
      },
      {
        lwin18: '1103034-2020-03-00750',
        productName: 'San Polo 2020',
        diff: -6,
        locationId: 'loc-a',
      },
      {
        lwin18: '1103034-2019-03-01500',
        productName: 'San Polo 2019 magnum',
        diff: -6,
        locationId: 'loc-a',
      },
    ]);

    expect(plan.repacks).toHaveLength(0);
  });

  it('only pairs equal and opposite amounts', () => {
    const plan = planLedgerReconcile([
      {
        lwin18: '1103034-2019-03-00750',
        productName: 'San Polo',
        diff: 18,
        locationId: 'loc-a',
      },
      {
        lwin18: '1103034-2019-06-00750',
        productName: 'San Polo',
        diff: -12,
        locationId: null,
      },
    ]);

    expect(plan.repacks).toHaveLength(0);
    expect(plan.topUps).toHaveLength(1);
    expect(plan.needsCount).toHaveLength(1);
  });

  it('handles the whole 17 Aug screen', () => {
    const plan = planLedgerReconcile([
      { lwin18: '1103034-2019-03-00750', productName: 'San Polo', diff: 18, locationId: 'a' },
      { lwin18: '1103034-2019-06-00750', productName: 'San Polo', diff: -18, locationId: null },
      { lwin18: '2421287-2020-01-00750', productName: 'Sena (1x)', diff: 5, locationId: 'b' },
      { lwin18: '1153143-2022-01-00750', productName: 'Le Petit Haut Lafitte (1x)', diff: 5, locationId: 'c' },
      { lwin18: '1013720-2019-01-00750', productName: 'La Parde (1x)', diff: 5, locationId: 'd' },
      { lwin18: '1104695-2015-01-00750', productName: 'Sandrone (1x)', diff: 5, locationId: 'e' },
      { lwin18: '1104653-2020-01-00750', productName: 'Guidalberto (1x)', diff: 5, locationId: 'f' },
      { lwin18: '1105487-2019-01-00750', productName: 'Talenti (1x)', diff: 5, locationId: 'g' },
    ]);

    expect(plan.repacks).toHaveLength(1);
    expect(plan.topUps).toHaveLength(6);
    expect(plan.needsCount).toHaveLength(0);
    // 18 - 18 + (6 x 5) = the 30 cases these lines contribute
    const cleared =
      plan.topUps.reduce((sum, t) => sum + t.cases, 0) +
      plan.repacks.reduce((sum, r) => sum + r.cases - r.cases, 0);
    expect(cleared).toBe(30);
  });
});

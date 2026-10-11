import { describe, expect, it } from 'vitest';

import planSkuCleanup, { type CleanupContext, type CleanupItem } from './planSkuCleanup';

const item = (over: Partial<CleanupItem>): CleanupItem => ({
  itemId: over.sku ?? 'x',
  name: 'Wine',
  sku: '',
  status: 'active',
  stockOnHand: 0,
  productType: 'goods',
  createdTime: '2025-06-01',
  ...over,
});

const ctx = (over: Partial<CleanupContext> = {}): CleanupContext => ({
  stockExplorer: new Map(),
  heldKeys: new Set(),
  openOrderItemIds: new Set(),
  newSince: '2026-09-01',
  ...over,
});

describe('planSkuCleanup', () => {
  it('adds dashes to a compact SKU on its own', () => {
    const [a] = planSkuCleanup([item({ sku: '101539120150600750' })], ctx({ heldKeys: new Set(['1015391-2015-00750']) }));
    expect(a).toMatchObject({ kind: 'add_dashes', toSku: '1015391-2015-06-00750', blocked: null });
  });

  it('keeps the stocked compact item, frees the dashed code from the empty twin, then dashes the kept one', () => {
    const actions = planSkuCleanup(
      [
        item({ itemId: 'old', name: 'Château Talbot 2020', sku: '101536220201200750', stockOnHand: 5 }),
        item({ itemId: 'new', name: 'Chateau Talbot 2020', sku: '1015362-2020-12-00750', createdTime: '2026-03-01' }),
      ],
      ctx(),
    );
    expect(actions).toEqual([
      expect.objectContaining({ itemId: 'new', kind: 'retire_duplicate', toSku: '1015362-2020-12-00750-OLD', keepItemId: 'old', blocked: null }),
      expect.objectContaining({ itemId: 'old', kind: 'add_dashes', toSku: '1015362-2020-12-00750', dependsOn: 'new' }),
    ]);
  });

  it('sends duplicates whose names disagree on vintage to review', () => {
    const actions = planSkuCleanup(
      [item({ itemId: 'a', name: 'Tignanello 2017', sku: '109539120150600750' }), item({ itemId: 'b', name: 'Tignanello 2015', sku: '1095391-2015-06-00750' })],
      ctx(),
    );
    expect(actions.map((a) => a.kind)).toEqual(['review', 'review']);
  });

  it('never retires an item holding stock or on an open order', () => {
    const actions = planSkuCleanup(
      [item({ itemId: 'w', sku: 'WKY-COM-700-BTL-UAE-ORC', stockOnHand: 253 }), item({ itemId: 'r', sku: 'RTD-JCO-355-CAN-UAE-MGO' })],
      ctx({ openOrderItemIds: new Set(['r']) }),
    );
    expect(actions.every((a) => a.kind === 'retire_non_lwin' && a.blocked)).toBe(true);
  });

  it('leaves service lines alone', () => {
    expect(planSkuCleanup([item({ name: 'Storage', sku: 'Storage', productType: 'service' }), item({ name: 'Transport Charges', sku: '' })], ctx())).toEqual([]);
  });

  it('offers a dashed code nothing holds, unless the wine is held in another pack or the item is new', () => {
    const items = [
      item({ itemId: 'gone', sku: '1000001-2010-06-00750' }),
      item({ itemId: 'repack', sku: '1000002-2015-03-00750' }),
      item({ itemId: 'fresh', sku: '1000003-2019-06-00750', createdTime: '2026-10-01' }),
    ];
    const actions = planSkuCleanup(items, ctx({ heldKeys: new Set(['1000002-2015-00750']) }));
    expect(actions.map((a) => [a.itemId, a.kind])).toEqual([['gone', 'retire_not_held']]);
  });
});

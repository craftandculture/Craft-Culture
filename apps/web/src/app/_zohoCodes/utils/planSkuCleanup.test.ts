import { describe, expect, it } from 'vitest';

import planSkuCleanup, { type CleanupContext, type CleanupItem, type StockExplorerLine } from './planSkuCleanup';

const item = (over: Partial<CleanupItem>): CleanupItem => ({
  itemId: over.sku || 'x',
  name: 'Wine',
  sku: '',
  status: 'active',
  productType: 'goods',
  createdTime: '2025-06-01',
  ...over,
});

const se = (lwin18: string, productName: string, vintage: number | null = null): [string, StockExplorerLine] => [
  lwin18,
  { lwin18, productName, producer: null, vintage },
];

const ctx = (over: Partial<CleanupContext> = {}): CleanupContext => ({
  stockExplorer: new Map(),
  heldKeys: new Set(),
  openItemIds: new Set(),
  newSince: '2026-09-01',
  ...over,
});

describe('planSkuCleanup', () => {
  it('retires an old-format item and recreates the wine from Stock Explorer under its old name', () => {
    const actions = planSkuCleanup(
      [item({ itemId: 'old', name: 'Chateau Talbot 2020 (12x75cl)', sku: '101536220201200750' })],
      ctx({ stockExplorer: new Map([se('1015362-2020-12-00750', 'Chateau Talbot', 2020)]) }),
    );
    expect(actions).toEqual([
      expect.objectContaining({ id: 'old', kind: 'retire', toName: 'Chateau Talbot 2020 (12x75cl) (old)', blocked: null }),
      expect.objectContaining({ id: 'new:1015362-2020-12-00750', kind: 'create', name: 'Chateau Talbot 2020 (12x75cl)', sku: '1015362-2020-12-00750' }),
    ]);
  });

  it('keeps a dashed item that Stock Explorer holds, and creates nothing for it', () => {
    const actions = planSkuCleanup(
      [item({ itemId: 'd', name: 'Sassicaia 2018', sku: '1015390-2018-06-00750' })],
      ctx({ stockExplorer: new Map([se('1015390-2018-06-00750', 'Sassicaia', 2018)]), heldKeys: new Set(['1015390-2018-00750']) }),
    );
    expect(actions).toEqual([]);
  });

  it('holds back an item on an open order or draft, but still creates the new one', () => {
    const actions = planSkuCleanup(
      [item({ itemId: 'old', name: 'Talbot', sku: '101536220201200750' })],
      ctx({ openItemIds: new Set(['old']), stockExplorer: new Map([se('1015362-2020-12-00750', 'Chateau Talbot', 2020)]) }),
    );
    expect(actions.map((a) => [a.kind, Boolean(a.blocked)])).toEqual([
      ['retire', true],
      ['create', false],
    ]);
  });

  it('retires brand codes and blanks, leaves service lines', () => {
    const actions = planSkuCleanup(
      [
        item({ itemId: 'w', sku: 'WKY-COM-700-BTL-UAE-ORC' }),
        item({ itemId: 'b', name: 'Il Poggione 2016', sku: '' }),
        item({ itemId: 's', name: 'Storage', sku: 'Storage', productType: 'service' }),
        item({ itemId: 't', name: 'Transport Charges', sku: '' }),
      ],
      ctx(),
    );
    expect(actions.map((a) => [a.id, a.kind])).toEqual([
      ['w', 'retire'],
      ['b', 'retire'],
    ]);
  });

  it('keeps one of two dashed items under a code, preferring the one on an open order', () => {
    const actions = planSkuCleanup(
      [
        item({ itemId: 'a', name: 'X 2015', sku: '1000001-2015-06-00750', createdTime: '2026-01-01' }),
        item({ itemId: 'b', name: 'X 2015 (6x75cl)', sku: '1000001-2015-06-00750', createdTime: '2025-01-01' }),
      ],
      ctx({ openItemIds: new Set(['b']), heldKeys: new Set(['1000001-2015-00750']) }),
    );
    expect(actions.map((a) => [a.id, a.kind])).toEqual([['a', 'retire_duplicate']]);
  });

  it('sends a dashed item whose name disagrees with its code vintage to review', () => {
    const actions = planSkuCleanup([item({ itemId: 't', name: 'Tignanello 2017', sku: '1095391-2015-06-00750' })], ctx());
    expect(actions[0]).toMatchObject({ kind: 'review' });
  });

  it('offers a dashed code nothing holds, unless held in another pack or new', () => {
    const items = [
      item({ itemId: 'gone', sku: '1000001-2010-06-00750' }),
      item({ itemId: 'repack', sku: '1000002-2015-03-00750' }),
      item({ itemId: 'fresh', sku: '1000003-2019-06-00750', createdTime: '2026-10-01' }),
    ];
    const actions = planSkuCleanup(items, ctx({ heldKeys: new Set(['1000002-2015-00750']) }));
    expect(actions.map((a) => [a.id, a.kind])).toEqual([['gone', 'retire_not_held']]);
  });
});

describe('itemNameFor', () => {
  it('puts the producer first only when the name leaves it out', async () => {
    const { itemNameFor } = await import('./planSkuCleanup');
    expect(itemNameFor({ productName: 'Mezcal - Blanco', vintage: null, producer: 'Bandida' }, 6, 700)).toBe('Bandida, Mezcal - Blanco (6x70cl)');
    expect(itemNameFor({ productName: 'Elio Grasso, Barolo', vintage: 2016, producer: 'Elio Grasso' }, 6, 750)).toBe('Elio Grasso, Barolo 2016 (6x75cl)');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import holdStockForSalesOrder from '@/app/_wms/utils/holdStockForSalesOrder';
import reconcileZohoSalesOrderItems from '@/app/_wms/utils/reconcileZohoSalesOrderItems';

import syncExistingSalesOrder from './syncExistingSalesOrder';

vi.mock('@/app/_wms/utils/holdStockForSalesOrder', () => ({
  default: vi.fn(),
}));
vi.mock('@/app/_wms/utils/reconcileZohoSalesOrderItems', () => ({
  default: vi.fn(),
}));
vi.mock('@/lib/zoho/salesOrders', () => ({
  getSalesOrder: vi.fn(async () => ({
    salesorder_number: 'SO-00001',
    total: 100,
    sub_total: 100,
    reference_number: null,
    line_items: [{ line_item_id: 'L1', sku: 'SKU', quantity: 2 }],
  })),
}));
vi.mock('@/app/_zohoSalesOrders/utils/pickInvoiceNumber', () => ({
  default: () => null,
}));

const zohoOrder = {
  salesorder_id: 'Z1',
  salesorder_number: 'SO-00001',
  status: 'invoiced',
  last_modified_time: '2026-10-24T08:00:00+0400',
};

/** A db stub that serves the stored header and records every update. */
const fakeDb = (stored: { zohoLastModifiedTime: Date | null }) => {
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ ...stored, zohoStatus: 'open' }],
          then: (resolve: (rows: unknown[]) => void) =>
            resolve([{ zohoLineItemId: 'L1', sku: 'SKU', quantity: 2 }]),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
  };
  return { db, updates };
};

const stampedAt = (updates: Record<string, unknown>[]) =>
  updates.findIndex((values) => 'zohoLastModifiedTime' in values);

describe('syncExistingSalesOrder', () => {
  beforeEach(() => {
    vi.mocked(reconcileZohoSalesOrderItems).mockResolvedValue({
      added: 0,
      updated: 1,
      removed: 0,
    });
    vi.mocked(holdStockForSalesOrder).mockResolvedValue({
      held: 1,
      short: [],
    });
  });

  it('stamps the last-modified time only after lines and holds succeed', async () => {
    const { db, updates } = fakeDb({ zohoLastModifiedTime: null });

    await syncExistingSalesOrder({
      existing: { id: 'o1', status: 'approved' },
      zohoOrder,
      db,
    });

    expect(stampedAt(updates)).toBe(updates.length - 1);
    expect(updates.at(-1)).toMatchObject({ zohoStatus: 'invoiced' });
  });

  it('leaves the order unstamped when holding stock fails, so it is retried', async () => {
    vi.mocked(holdStockForSalesOrder).mockRejectedValue(
      new Error('connection dropped'),
    );
    const { db, updates } = fakeDb({ zohoLastModifiedTime: null });

    await expect(
      syncExistingSalesOrder({
        existing: { id: 'o1', status: 'approved' },
        zohoOrder,
        db,
      }),
    ).rejects.toThrow('connection dropped');

    expect(stampedAt(updates)).toBe(-1);
  });

  it('leaves a settled order unstamped when its line reconcile fails', async () => {
    vi.mocked(reconcileZohoSalesOrderItems).mockRejectedValue(
      new Error('connection dropped'),
    );
    const { db, updates } = fakeDb({
      zohoLastModifiedTime: new Date('2026-10-01T00:00:00Z'),
    });

    await expect(
      syncExistingSalesOrder({
        existing: { id: 'o1', status: 'dispatched' },
        zohoOrder,
        db,
      }),
    ).rejects.toThrow('connection dropped');

    expect(stampedAt(updates)).toBe(-1);
  });

  it('does not flag a released order that was never stamped when its lines match', async () => {
    const { db, updates } = fakeDb({ zohoLastModifiedTime: null });

    const result = await syncExistingSalesOrder({
      existing: { id: 'o1', status: 'picking' },
      zohoOrder,
      db,
    });

    expect(result.outcome).toBe('unchanged');
    expect(
      updates.some((values) => 'soModifiedAfterRelease' in values),
    ).toBe(false);
    expect(stampedAt(updates)).toBe(updates.length - 1);
  });
});

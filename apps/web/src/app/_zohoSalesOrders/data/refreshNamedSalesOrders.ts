import { inArray } from 'drizzle-orm';

import syncExistingSalesOrder from '@/app/_wms/utils/syncExistingSalesOrder';
import db from '@/database/client';
import { zohoSalesOrders } from '@/database/schema';
import { getSalesOrder } from '@/lib/zoho/salesOrders';

/**
 * Re-read just the named sales orders from Zoho, nothing else
 *
 * The scanner's re-sync used to run the whole sync to refresh one order:
 * every open and invoiced order listed page by page, then held drafts, closed
 * orders and PCO links. On a scanner that ran past the request timeout, so the
 * operator was told Zoho could not be reached when it simply had not finished.
 * It also never refreshed a partially invoiced order, because the full sync
 * only finds orders through its open and invoiced listings and the force flag
 * only applies to orders those listings return.
 *
 * Here each order is looked up locally, fetched from Zoho by its id and
 * reconciled through the same helper the full sync uses, forced, so an
 * item-master SKU fix comes through. Orders the warehouse has never synced
 * are reported as failed rather than created: creating and holding stock for
 * a new order is the full sync's job.
 *
 * @example
 *   const result = await refreshNamedSalesOrders(['SO-00231']);
 *   result.message; // 'Refreshed 1 of 1 orders from Zoho'
 *
 * @param orderNumbers - Zoho sales order numbers, as stored locally
 * @returns The same shape as the full sync, so callers need not tell them apart
 */
const refreshNamedSalesOrders = async (orderNumbers: string[]) => {
  const wanted = [...new Set(orderNumbers)];
  const failed: { salesOrderNumber: string; reason: string }[] = [];
  let updated = 0;

  const rows = wanted.length
    ? await db
        .select({
          id: zohoSalesOrders.id,
          status: zohoSalesOrders.status,
          zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
          salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        })
        .from(zohoSalesOrders)
        .where(inArray(zohoSalesOrders.salesOrderNumber, wanted))
    : [];

  const found = new Set(rows.map((row) => row.salesOrderNumber));
  for (const number of wanted) {
    if (!found.has(number)) {
      failed.push({ salesOrderNumber: number, reason: 'Not synced to the warehouse yet; run a full sync' });
    }
  }

  for (const row of rows) {
    try {
      const zohoOrder = await getSalesOrder(row.zohoSalesOrderId);
      const result = await syncExistingSalesOrder({
        existing: { id: row.id, status: row.status },
        zohoOrder,
        db,
        force: true,
      });
      if (result.outcome === 'reconciled' || result.outcome === 'flagged') updated++;
    } catch (error) {
      failed.push({
        salesOrderNumber: row.salesOrderNumber,
        reason: (error instanceof Error ? error.message : String(error)).slice(0, 160),
      });
      console.error('Failed to refresh sales order', { salesOrderNumber: row.salesOrderNumber, error });
    }
  }

  return {
    success: true,
    fetched: rows.length,
    created: 0,
    updated,
    errors: failed.length,
    draftHoldsRefreshed: 0,
    failed,
    shortOnSync: [] as string[],
    releasedClosed: [] as { salesOrderNumber: string; cases: number; status: string }[],
    message: `Refreshed ${rows.length - failed.filter((f) => found.has(f.salesOrderNumber)).length} of ${wanted.length} orders from Zoho${
      failed.length ? `. Not refreshed: ${failed.map((f) => `${f.salesOrderNumber} (${f.reason})`).join('; ')}` : ''
    }`,
  };
};

export default refreshNamedSalesOrders;

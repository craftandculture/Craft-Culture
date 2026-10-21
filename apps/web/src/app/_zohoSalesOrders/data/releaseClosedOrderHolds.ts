import { and, eq, notInArray, sql } from 'drizzle-orm';

import releaseStockReservations from '@/app/_wms/utils/releaseStockReservations';
import { wmsStockReservations, zohoSalesOrders } from '@/database/schema';
import { getSalesOrder } from '@/lib/zoho/salesOrders';

interface ReleaseClosedOrderHoldsParams {
  /** Every Zoho sales order id the sync's open + invoiced listing returned */
  seenZohoIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/** Detail requests per run, to stay inside Zoho's rate limit */
const MAX_CHECKED = 25;

/**
 * Release stock held for sales orders that have been voided in Zoho
 *
 * The syncs list open and invoiced orders only, so a voided order simply stops
 * appearing and nothing released the cases it held. Absence alone is not
 * proof (a paging failure looks the same), so each missing order is fetched
 * and released only when Zoho confirms it is void or draft.
 *
 * Orders the listing DID return are excluded before the limit is applied.
 * They used to fill the 25 checks, so a voided order behind enough open ones
 * was never looked at and its stock stayed reserved. The rest are taken in
 * random order, so a missing order that is neither void nor draft cannot
 * crowd out the others run after run.
 *
 * @example
 *   await releaseClosedOrderHolds({ db, seenZohoIds });
 */
const releaseClosedOrderHolds = async ({
  seenZohoIds,
  db,
}: ReleaseClosedOrderHoldsParams) => {
  // Nothing came back at all: that is an outage, not an empty Zoho
  if (seenZohoIds.length === 0) return { checked: 0, released: [] };

  const candidates: {
    id: string;
    zohoSalesOrderId: string;
    salesOrderNumber: string;
  }[] = await db
    .selectDistinct({
      id: zohoSalesOrders.id,
      zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
    })
    .from(zohoSalesOrders)
    .innerJoin(
      wmsStockReservations,
      and(
        eq(wmsStockReservations.orderId, zohoSalesOrders.id),
        eq(wmsStockReservations.orderType, 'zoho'),
        eq(wmsStockReservations.status, 'active'),
      ),
    )
    .where(notInArray(zohoSalesOrders.zohoSalesOrderId, seenZohoIds))
    .orderBy(sql`random()`)
    .limit(MAX_CHECKED);

  const released: { salesOrderNumber: string; cases: number; status: string }[] = [];

  for (const candidate of candidates) {
    const remote = await getSalesOrder(candidate.zohoSalesOrderId).catch(
      () => null,
    );

    // Unreachable is not the same as gone. Leave it for the next run.
    if (!remote) continue;

    if (remote.status !== 'void' && remote.status !== 'draft') continue;

    const result = await releaseStockReservations({
      orderType: 'zoho',
      orderId: candidate.id,
      reason: `Order ${remote.status} in Zoho`,
      db,
    });

    if (result.releasedCount > 0) {
      released.push({
        salesOrderNumber: candidate.salesOrderNumber,
        cases: result.totalCasesReleased,
        status: remote.status,
      });
    }
  }

  return { checked: candidates.length, released };
};

export default releaseClosedOrderHolds;

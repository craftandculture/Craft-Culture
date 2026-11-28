import { and, eq, exists, isNull, lt, notInArray, or, sql } from 'drizzle-orm';

import releaseStockReservations from '@/app/_wms/utils/releaseStockReservations';
import isZohoOrderGone from '@/app/_zohoSalesOrders/utils/isZohoOrderGone';
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
 * How long an order Zoho confirmed as still live is left alone before it is
 * asked about again. Without it the same orders were fetched on every
 * 5-minute sync: 18 of them on 28 Nov 2026, about 5,000 calls a day, which
 * took Zoho's 10,000 daily limit and blocked the order desk (PCO-2026-00122).
 */
const RECHECK_AFTER_HOURS = 6;

/**
 * Release stock held for sales orders that have been voided or deleted in Zoho
 *
 * The syncs list open and invoiced orders only, so a voided order simply stops
 * appearing and nothing released the cases it held. Absence alone is not
 * proof (a paging failure looks the same), so each missing order is fetched
 * and released only when Zoho confirms it is void or draft, or answers that it
 * does not exist. A deleted order used to be skipped as "unreachable" on every
 * run, so its cases stayed reserved for good (SO-00202).
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
  if (seenZohoIds.length === 0) return { checked: 0, released: [], stillLive: [] };

  const candidates: {
    id: string;
    zohoSalesOrderId: string;
    salesOrderNumber: string;
  }[] = await db
    /*
      EXISTS rather than a join with DISTINCT: Postgres refuses SELECT DISTINCT
      with ORDER BY random(), so this step threw on every sync from 21 Oct and
      orders voided in Zoho kept their stock held (the error was caught and
      logged, so nothing on screen showed it).
    */
    .select({
      id: zohoSalesOrders.id,
      zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
    })
    .from(zohoSalesOrders)
    .where(
      and(
        notInArray(zohoSalesOrders.zohoSalesOrderId, seenZohoIds),
        or(
          isNull(zohoSalesOrders.lastSyncAt),
          lt(
            zohoSalesOrders.lastSyncAt,
            new Date(Date.now() - RECHECK_AFTER_HOURS * 60 * 60 * 1000),
          ),
        ),
        exists(
          db
            .select({ one: sql`1` })
            .from(wmsStockReservations)
            .where(
              and(
                eq(wmsStockReservations.orderId, zohoSalesOrders.id),
                eq(wmsStockReservations.orderType, 'zoho'),
                eq(wmsStockReservations.status, 'active'),
              ),
            ),
        ),
      ),
    )
    .orderBy(sql`random()`)
    .limit(MAX_CHECKED);

  const released: { salesOrderNumber: string; cases: number; status: string }[] = [];
  /** Orders holding stock that Zoho says are still live, and their status */
  const stillLive: { salesOrderNumber: string; status: string }[] = [];

  for (const candidate of candidates) {
    let status: string | undefined;
    try {
      const remote = await getSalesOrder(candidate.zohoSalesOrderId);
      status = remote?.status;
    } catch (error) {
      // Unreachable is not the same as gone. Leave it for the next run.
      if (!isZohoOrderGone(error)) continue;
      status = 'deleted';
    }

    if (status !== 'void' && status !== 'draft' && status !== 'deleted') {
      // Asked and answered: not again for RECHECK_AFTER_HOURS
      await db
        .update(zohoSalesOrders)
        .set({ lastSyncAt: new Date() })
        .where(eq(zohoSalesOrders.id, candidate.id));
      stillLive.push({ salesOrderNumber: candidate.salesOrderNumber, status: status ?? 'unknown' });
      continue;
    }

    const result = await releaseStockReservations({
      orderType: 'zoho',
      orderId: candidate.id,
      reason: `Order ${status} in Zoho`,
      db,
    });

    if (result.releasedCount > 0) {
      released.push({
        salesOrderNumber: candidate.salesOrderNumber,
        cases: result.totalCasesReleased,
        status,
      });
    }
  }

  return { checked: candidates.length, released, stillLive };
};

export default releaseClosedOrderHolds;

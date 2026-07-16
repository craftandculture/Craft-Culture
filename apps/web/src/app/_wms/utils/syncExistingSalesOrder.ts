import { eq } from 'drizzle-orm';

import reconcileZohoSalesOrderItems from '@/app/_wms/utils/reconcileZohoSalesOrderItems';
import { zohoSalesOrders } from '@/database/schema';
import { getSalesOrder } from '@/lib/zoho/salesOrders';

interface ZohoOrderSummary {
  salesorder_id: string;
  salesorder_number: string;
  status: string;
  last_modified_time: string;
}

interface SyncExistingParams {
  existing: { id: string; status: string | null };
  zohoOrder: ZohoOrderSummary;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/** Statuses with no pick list yet — the order can be reconciled in full. */
const PRE_PICK_STATUSES = new Set(['synced', 'approved']);

/** Statuses where a pick list already snapshots the lines. */
const RELEASED_STATUSES = new Set(['picking', 'picked']);

/**
 * Sync an already-synced Zoho sales order so a later Zoho edit (e.g. the client
 * changes their mind) reaches the warehouse instead of going stale.
 *
 * Both the scheduled job and the manual "Sync from Zoho" button call this, so
 * the two paths can never drift again — that drift is what left the button
 * insert-only and froze SO-00099's Talbot line at the old quantity while its
 * header total moved on.
 *
 * - Pre-pick (`synced`/`approved`): header + line items are reconciled in full
 *   (add / update / delete), releasing stock reservations for changed lines.
 * - Released (`picking`/`picked`): the header total is refreshed and, on a real
 *   change, `soModifiedAfterRelease` is raised so the pick is reviewed rather
 *   than silently rewritten under an operator mid-pick.
 * - Terminal (`dispatched`/`delivered`/`cancelled`): left untouched.
 *
 * @example
 *   const result = await syncExistingSalesOrder({ existing, zohoOrder, db });
 *   if (result.outcome === 'reconciled' || result.outcome === 'flagged') {
 *     results.updated++;
 *   }
 *
 * @param existing - The local row ({ id, status }) already found for this order
 * @param zohoOrder - The order summary from Zoho's list endpoint
 * @param db - Drizzle db handle (cloud client or trigger client)
 * @returns The sync outcome, for counting/logging by the caller
 */
const syncExistingSalesOrder = async ({
  existing,
  zohoOrder,
  db,
}: SyncExistingParams) => {
  const status = existing.status ?? 'synced';

  if (!PRE_PICK_STATUSES.has(status) && !RELEASED_STATUSES.has(status)) {
    return { outcome: 'skipped' as const };
  }

  const zohoModifiedAt = new Date(zohoOrder.last_modified_time);
  const fullOrder = await getSalesOrder(zohoOrder.salesorder_id);

  if (PRE_PICK_STATUSES.has(status)) {
    await db
      .update(zohoSalesOrders)
      .set({
        zohoStatus: zohoOrder.status,
        zohoLastModifiedTime: zohoModifiedAt,
        total: fullOrder.total,
        subTotal: fullOrder.sub_total,
        lastSyncAt: new Date(),
      })
      .where(eq(zohoSalesOrders.id, existing.id));

    const reconciled =
      fullOrder.line_items && fullOrder.line_items.length > 0
        ? await reconcileZohoSalesOrderItems({
            orderId: existing.id,
            zohoLineItems: fullOrder.line_items,
            db,
          })
        : { added: 0, updated: 0, removed: 0 };

    return { outcome: 'reconciled' as const, reconciled };
  }

  // Released to picking/picked — only act on a genuine change so we don't flag
  // on every 2-minute poll. Compare Zoho's last-modified against what we stored.
  const [current] = await db
    .select({ zohoLastModifiedTime: zohoSalesOrders.zohoLastModifiedTime })
    .from(zohoSalesOrders)
    .where(eq(zohoSalesOrders.id, existing.id))
    .limit(1);

  const unchanged =
    current?.zohoLastModifiedTime instanceof Date &&
    current.zohoLastModifiedTime.getTime() === zohoModifiedAt.getTime();

  if (unchanged) {
    return { outcome: 'unchanged' as const };
  }

  // Refresh the header so the total is truthful, and raise the flag so the pick
  // screen can prompt a review. We deliberately do NOT rewrite the pick's lines
  // here — that is an explicit "re-sync pick" action, not a silent mutation.
  await db
    .update(zohoSalesOrders)
    .set({
      zohoStatus: zohoOrder.status,
      zohoLastModifiedTime: zohoModifiedAt,
      total: fullOrder.total,
      subTotal: fullOrder.sub_total,
      soModifiedAfterRelease: true,
      soModifiedAt: new Date(),
      lastSyncAt: new Date(),
    })
    .where(eq(zohoSalesOrders.id, existing.id));

  return { outcome: 'flagged' as const };
};

export default syncExistingSalesOrder;

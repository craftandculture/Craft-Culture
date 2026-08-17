import { eq } from 'drizzle-orm';

import reconcileZohoSalesOrderItems from '@/app/_wms/utils/reconcileZohoSalesOrderItems';
import pickInvoiceNumber from '@/app/_zohoSalesOrders/utils/pickInvoiceNumber';
import { zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
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
  force?: boolean;
}

/** Statuses with no pick list yet — the order can be reconciled in full. */
const PRE_PICK_STATUSES = new Set(['synced', 'approved']);

/** Statuses where a pick list already snapshots the lines. */
const RELEASED_STATUSES = new Set(['picking', 'picked']);

/** The line fields a pick depends on — a change to any must be reviewed. */
const lineFingerprint = (line: {
  zohoLineItemId: string | null;
  sku: string | null;
  quantity: number | null;
}) => `${line.zohoLineItemId ?? ''}|${line.sku ?? ''}|${line.quantity ?? 0}`;

/**
 * Have the order's pick-relevant lines actually changed?
 *
 * Compares the stored lines against what Zoho just returned, on line id, SKU
 * and quantity only. Rate and description drift constantly and never alter what
 * comes off the shelf, so they are ignored — otherwise a forced pass would flag
 * every released order for review on a price edit.
 *
 * @param orderId - Local sales order id
 * @param zohoLineItems - `line_items` from the Zoho detail payload
 * @param db - Drizzle db handle
 * @returns True when a line was added, removed, re-SKU'd or re-quantified
 */
const linesChanged = async ({
  orderId,
  zohoLineItems,
  db,
}: {
  orderId: string;
  zohoLineItems: {
    line_item_id: string;
    sku?: string | null;
    quantity: number;
  }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}) => {
  const stored: {
    zohoLineItemId: string;
    sku: string | null;
    quantity: number;
  }[] = await db
    .select({
      zohoLineItemId: zohoSalesOrderItems.zohoLineItemId,
      sku: zohoSalesOrderItems.sku,
      quantity: zohoSalesOrderItems.quantity,
    })
    .from(zohoSalesOrderItems)
    .where(eq(zohoSalesOrderItems.salesOrderId, orderId));

  const before = new Set(stored.map(lineFingerprint));
  const after = new Set(
    zohoLineItems.map((line) =>
      lineFingerprint({
        zohoLineItemId: line.line_item_id,
        sku: line.sku ?? null,
        quantity: line.quantity,
      }),
    ),
  );

  if (before.size !== after.size) return true;
  for (const fingerprint of after) {
    if (!before.has(fingerprint)) return true;
  }
  return false;
};

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
 * @param force - Re-fetch the details even when Zoho reports the order
 *   unchanged. Item-master edits (e.g. fixing a SKU's pack digits) don't bump
 *   the order's last-modified time, so only a forced pass picks them up.
 * @returns The sync outcome, for counting/logging by the caller
 */
const syncExistingSalesOrder = async ({
  existing,
  zohoOrder,
  db,
  force = false,
}: SyncExistingParams) => {
  const status = existing.status ?? 'synced';

  if (!PRE_PICK_STATUSES.has(status) && !RELEASED_STATUSES.has(status)) {
    return { outcome: 'skipped' as const };
  }

  const zohoModifiedAt = new Date(zohoOrder.last_modified_time);

  // Short-circuit BEFORE the expensive full-detail fetch: if Zoho's
  // last-modified time matches what we already stored, nothing changed, so skip
  // the getSalesOrder call entirely. This keeps the 2-minute poll to ~0 detail
  // requests when orders are idle (previously every pre-pick order was fetched
  // and reconciled each cycle — heavy on Zoho's rate limit).
  const [current] = await db
    .select({
      zohoLastModifiedTime: zohoSalesOrders.zohoLastModifiedTime,
      zohoStatus: zohoSalesOrders.zohoStatus,
    })
    .from(zohoSalesOrders)
    .where(eq(zohoSalesOrders.id, existing.id))
    .limit(1);

  // A forced pass overrides the short-circuit in both states. Pre-pick it
  // results in a line reconcile; on a released order it fetches the detail so
  // the lines can be COMPARED — the flag is then raised only if they really
  // differ (see below), never merely because the pass was forced. Item-master
  // edits (fixing a SKU's pack digits) don't bump the order's last-modified
  // time, so a released pick would otherwise be stranded on the old SKU with no
  // way to refresh it.
  const forceDetailFetch = force;

  // Raising an invoice in Zoho flips the order open -> invoiced without always
  // bumping its last-modified time, and that status is exactly what gates
  // "Ready for Release". Short-circuiting on the timestamp alone stranded such
  // orders in Pending Invoice with no way out: the sales-orders page syncs
  // without force, and the new-pick screen only force-refreshes orders already
  // listed as ready. The status is already in the cheap list payload, so
  // comparing it costs nothing and closes that trap.
  const statusChanged = current?.zohoStatus !== zohoOrder.status;

  const unchanged =
    !forceDetailFetch &&
    !statusChanged &&
    current?.zohoLastModifiedTime instanceof Date &&
    current.zohoLastModifiedTime.getTime() === zohoModifiedAt.getTime();

  if (unchanged) {
    return { outcome: 'unchanged' as const };
  }

  const fullOrder = await getSalesOrder(zohoOrder.salesorder_id);

  // Only ever set the invoice number, never clear one we already hold — the
  // detail payload is the authoritative link but an older sync may have
  // backfilled it from zoho_invoices.
  const invoiceNumber = pickInvoiceNumber(fullOrder);
  const invoiceUpdate = invoiceNumber ? { invoiceNumber } : {};

  if (PRE_PICK_STATUSES.has(status)) {
    await db
      .update(zohoSalesOrders)
      .set({
        zohoStatus: zohoOrder.status,
        zohoLastModifiedTime: zohoModifiedAt,
        total: fullOrder.total,
        subTotal: fullOrder.sub_total,
        ...invoiceUpdate,
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

  // Released to picking/picked. Refresh the header so the total is truthful,
  // and raise the flag so the pick screen can prompt a review. We deliberately
  // do NOT rewrite the pick's lines here — that is an explicit "re-sync pick"
  // action, not a silent mutation under an operator mid-pick.
  //
  // Zoho reporting a newer last-modified time is enough on its own. A forced
  // pass on an order Zoho says is unchanged must prove the lines moved before
  // flagging, so a routine force-refresh doesn't mark every released pick for
  // review.
  const zohoReportsChange =
    !(current?.zohoLastModifiedTime instanceof Date) ||
    current.zohoLastModifiedTime.getTime() !== zohoModifiedAt.getTime();

  const shouldFlag =
    zohoReportsChange ||
    (await linesChanged({
      orderId: existing.id,
      zohoLineItems: fullOrder.line_items ?? [],
      db,
    }));

  await db
    .update(zohoSalesOrders)
    .set({
      zohoStatus: zohoOrder.status,
      zohoLastModifiedTime: zohoModifiedAt,
      total: fullOrder.total,
      subTotal: fullOrder.sub_total,
      ...invoiceUpdate,
      ...(shouldFlag
        ? { soModifiedAfterRelease: true, soModifiedAt: new Date() }
        : {}),
      lastSyncAt: new Date(),
    })
    .where(eq(zohoSalesOrders.id, existing.id));

  return shouldFlag
    ? ({ outcome: 'flagged' } as const)
    : ({ outcome: 'unchanged' } as const);
};

export default syncExistingSalesOrder;

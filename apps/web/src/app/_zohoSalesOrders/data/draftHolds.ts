import { and, eq, inArray } from 'drizzle-orm';

import { type HoldShort, holdLines } from '@/app/_wms/utils/holdStockForSalesOrder';
import releaseLineHolds from '@/app/_wms/utils/releaseLineHolds';
import releaseStockReservations from '@/app/_wms/utils/releaseStockReservations';
import {
  wmsStockReservations,
  zohoDraftHoldLines,
  zohoDraftHolds,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { getSalesOrder } from '@/lib/zoho/salesOrders';
import type { ZohoSalesOrder } from '@/lib/zoho/types';

/*
  Drafts are held on request, not automatically: a draft can sit in Zoho for
  weeks or be abandoned, and holding every one would lock wine away from
  orders that are real. Someone who is building an order for a client asks
  for its wine to be held; the hold then follows the draft.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type DraftLine = ZohoSalesOrder['line_items'][number] & { item_type?: string };

/** A line worth holding: a wine with a code and a quantity, not a heading */
const holdable = (line: DraftLine) => Boolean(line.sku) && line.quantity > 0 && !/header/i.test(line.item_type ?? '');

/** Zoho answers a deleted order with an error, not an empty one */
const isGone = (error: unknown) => /does not exist|not found|404|1002/i.test(error instanceof Error ? error.message : String(error));

/**
 * Bring a hold's lines into line with the draft, then hold what is not held
 *
 * A line whose code, quantity, unit or pack text changed gives its cases back
 * and is held afresh; a removed line gives its cases back; a new line is
 * held. So the hold always matches what the client has on the draft now.
 */
const syncLines = async (db: Db, hold: { id: string; salesOrderNumber: string }, remote: ZohoSalesOrder) => {
  const wanted = (remote.line_items as DraftLine[]).filter(holdable);
  const current: (typeof zohoDraftHoldLines.$inferSelect)[] = await db
    .select()
    .from(zohoDraftHoldLines)
    .where(eq(zohoDraftHoldLines.holdId, hold.id));
  const byZohoId = new Map(current.map((l) => [l.zohoLineItemId, l]));
  const wantedIds = new Set(wanted.map((l) => l.line_item_id));

  const gone = current.filter((l) => !wantedIds.has(l.zohoLineItemId));
  if (gone.length) {
    await releaseLineHolds({ db, orderItemIds: gone.map((l) => l.id), reason: 'Line removed from the draft' });
    await db.delete(zohoDraftHoldLines).where(inArray(zohoDraftHoldLines.id, gone.map((l) => l.id)));
  }

  for (const line of wanted) {
    const mine = byZohoId.get(line.line_item_id);
    const fields = {
      sku: line.sku ?? null,
      name: line.name,
      description: line.description ?? null,
      quantity: line.quantity,
      unit: line.unit ?? null,
    };

    if (!mine) {
      await db.insert(zohoDraftHoldLines).values({ holdId: hold.id, zohoLineItemId: line.line_item_id, ...fields });
      continue;
    }

    const changed =
      mine.sku !== fields.sku || mine.quantity !== fields.quantity || mine.unit !== fields.unit || mine.description !== fields.description;
    if (changed) {
      await releaseLineHolds({ db, orderItemIds: [mine.id], reason: 'Line changed on the draft' });
      await db.update(zohoDraftHoldLines).set({ ...fields, updatedAt: new Date() }).where(eq(zohoDraftHoldLines.id, mine.id));
    }
  }

  const lines = await db.select().from(zohoDraftHoldLines).where(eq(zohoDraftHoldLines.holdId, hold.id));

  return holdLines({ db, orderType: 'zoho_draft', orderId: hold.id, orderNumber: hold.salesOrderNumber, lines });
};

/**
 * Hand a confirmed draft's holds to the synced sales order
 *
 * Each draft line passes its holds to the order line Zoho kept the same id
 * for, if it is still the same wine and quantity — so confirming an order
 * never holds its wine twice. A line that changed on the way gives its cases
 * back, and the order's own hold step takes it from there.
 *
 * @param params.zohoSalesOrderId - Zoho's id for the order
 * @param params.orderId - The synced zoho_sales_orders row
 * @returns Whether a draft hold was found and handed over
 */
export const adoptDraftHolds = async ({ db, zohoSalesOrderId, orderId }: { db: Db; zohoSalesOrderId: string; orderId: string }) => {
  const [hold] = await db
    .select()
    .from(zohoDraftHolds)
    .where(and(eq(zohoDraftHolds.zohoSalesOrderId, zohoSalesOrderId), eq(zohoDraftHolds.status, 'active')));
  if (!hold) return { adopted: false };

  const [order] = await db.select({ number: zohoSalesOrders.salesOrderNumber }).from(zohoSalesOrders).where(eq(zohoSalesOrders.id, orderId));
  const [draftLines, orderLines] = await Promise.all([
    db.select().from(zohoDraftHoldLines).where(eq(zohoDraftHoldLines.holdId, hold.id)),
    db.select().from(zohoSalesOrderItems).where(eq(zohoSalesOrderItems.salesOrderId, orderId)),
  ]);

  for (const line of draftLines as (typeof zohoDraftHoldLines.$inferSelect)[]) {
    const match = (orderLines as (typeof zohoSalesOrderItems.$inferSelect)[]).find(
      (o) => o.zohoLineItemId === line.zohoLineItemId && o.sku === line.sku && o.quantity === line.quantity,
    );

    if (match) {
      await db
        .update(wmsStockReservations)
        .set({ orderType: 'zoho', orderId, orderItemId: match.id, orderNumber: order?.number ?? hold.salesOrderNumber, updatedAt: new Date() })
        .where(and(eq(wmsStockReservations.orderItemId, line.id), eq(wmsStockReservations.status, 'active')));
    } else {
      await releaseLineHolds({ db, orderItemIds: [line.id], reason: 'Line changed when the draft was confirmed' });
    }
  }

  await db
    .update(zohoDraftHolds)
    .set({ status: 'confirmed', statusReason: `Confirmed as ${order?.number ?? hold.salesOrderNumber}`, updatedAt: new Date() })
    .where(eq(zohoDraftHolds.id, hold.id));

  return { adopted: true };
};

/**
 * Re-read a held draft from Zoho and bring its hold up to date
 *
 * Still a draft: lines reconciled and held. Voided or deleted: everything
 * released. Confirmed: handed to the synced order if it is in, otherwise left
 * until the sync brings it in (which hands it over then).
 *
 * @param params.holdId - The draft hold
 * @returns What happened, and any lines short of stock
 */
export const refreshDraftHold = async ({ db, holdId }: { db: Db; holdId: string }) => {
  const [hold] = await db.select().from(zohoDraftHolds).where(eq(zohoDraftHolds.id, holdId));
  if (!hold || hold.status !== 'active') return { outcome: 'inactive' as const, short: [] as HoldShort[] };

  let remote: ZohoSalesOrder | null = null;
  try {
    remote = await getSalesOrder(hold.zohoSalesOrderId);
  } catch (error) {
    if (!isGone(error)) return { outcome: 'unreachable' as const, short: [] as HoldShort[] };
  }

  const release = async (reason: string) => {
    await releaseStockReservations({ db, orderType: 'zoho_draft', orderId: hold.id, reason });
    await db.update(zohoDraftHolds).set({ status: 'released', statusReason: reason, updatedAt: new Date() }).where(eq(zohoDraftHolds.id, hold.id));
  };

  if (!remote) {
    await release('Draft deleted in Zoho');
    return { outcome: 'released' as const, short: [] as HoldShort[] };
  }
  if (remote.status === 'void') {
    await release('Order voided in Zoho');
    return { outcome: 'released' as const, short: [] as HoldShort[] };
  }

  if (remote.status !== 'draft') {
    const [synced] = await db
      .select({ id: zohoSalesOrders.id })
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.zohoSalesOrderId, hold.zohoSalesOrderId));
    if (synced) {
      await adoptDraftHolds({ db, zohoSalesOrderId: hold.zohoSalesOrderId, orderId: synced.id });
      return { outcome: 'confirmed' as const, short: [] as HoldShort[] };
    }
    return { outcome: 'awaiting_sync' as const, short: [] as HoldShort[] };
  }

  const result = await syncLines(db, hold, remote);
  await db
    .update(zohoDraftHolds)
    .set({ customerName: remote.customer_name, lastRefreshedAt: new Date(), updatedAt: new Date() })
    .where(eq(zohoDraftHolds.id, hold.id));

  return { outcome: 'held' as const, short: result.short };
};

/**
 * Start holding a draft's wine, or refresh the hold if one is already running
 *
 * @param params.remote - The draft as Zoho returns it
 * @param params.userId - Who asked for the hold
 */
export const startDraftHold = async ({ db, remote, userId }: { db: Db; remote: ZohoSalesOrder; userId: string }) => {
  const [existing] = await db.select().from(zohoDraftHolds).where(eq(zohoDraftHolds.zohoSalesOrderId, remote.salesorder_id));

  let holdId: string;
  if (existing) {
    holdId = existing.id;
    await db
      .update(zohoDraftHolds)
      .set({ status: 'active', statusReason: null, salesOrderNumber: remote.salesorder_number, customerName: remote.customer_name, updatedAt: new Date() })
      .where(eq(zohoDraftHolds.id, holdId));
  } else {
    const [row] = await db
      .insert(zohoDraftHolds)
      .values({
        zohoSalesOrderId: remote.salesorder_id,
        salesOrderNumber: remote.salesorder_number,
        customerName: remote.customer_name,
        createdBy: userId,
      })
      .returning({ id: zohoDraftHolds.id });
    holdId = row.id;
  }

  const result = await syncLines(db, { id: holdId, salesOrderNumber: remote.salesorder_number }, remote);
  await db.update(zohoDraftHolds).set({ lastRefreshedAt: new Date() }).where(eq(zohoDraftHolds.id, holdId));

  return { holdId, ...result };
};

/** Release a draft hold by hand, giving every case back */
export const releaseDraftHold = async ({ db, holdId, reason }: { db: Db; holdId: string; reason: string }) => {
  const released = await releaseStockReservations({ db, orderType: 'zoho_draft', orderId: holdId, reason });
  await db.update(zohoDraftHolds).set({ status: 'released', statusReason: reason, updatedAt: new Date() }).where(eq(zohoDraftHolds.id, holdId));
  return released;
};

/** Bring every active draft hold up to date; one that fails is left for next time */
export const refreshAllDraftHolds = async ({ db }: { db: Db }) => {
  const active: { id: string }[] = await db.select({ id: zohoDraftHolds.id }).from(zohoDraftHolds).where(eq(zohoDraftHolds.status, 'active'));
  let refreshed = 0;
  for (const { id } of active) {
    try {
      await refreshDraftHold({ db, holdId: id });
      refreshed += 1;
    } catch {
      // Next refresh tries again
    }
  }
  return { refreshed, active: active.length };
};

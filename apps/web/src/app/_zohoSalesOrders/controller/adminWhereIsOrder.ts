import { eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPickLists, zohoInvoices, zohoSalesOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listInvoices } from '@/lib/zoho/invoices';
import { listSalesOrders } from '@/lib/zoho/salesOrders';

import isPickableZohoStatus from '../utils/isPickableZohoStatus';

/** Why an order is, or is not, on the New Pick List screen. */
type Reason =
  | 'on_list'
  | 'not_invoiced'
  | 'picking'
  | 'picked'
  | 'dispatched'
  | 'cancelled'
  | 'not_synced'
  | 'not_in_zoho';

interface Explained {
  salesOrderNumber: string | null;
  invoiceNumber: string | null;
  referenceNumber: string | null;
  customerName: string | null;
  reason: Reason;
  zohoStatus: string | null;
  pickListNumber: string | null;
  pickListId: string | null;
  /** When the pick finished, for "picked" */
  pickedAt: Date | null;
}

const explainLocal = (
  order: typeof zohoSalesOrders.$inferSelect,
  pickList: { id: string; pickListNumber: string; completedAt: Date | null } | null,
): Explained => {
  const base = {
    salesOrderNumber: order.salesOrderNumber,
    invoiceNumber: order.invoiceNumber,
    referenceNumber: order.referenceNumber,
    customerName: order.customerName,
    zohoStatus: order.zohoStatus,
    pickListNumber: pickList?.pickListNumber ?? null,
    pickListId: pickList?.id ?? null,
    pickedAt: pickList?.completedAt ?? null,
  };

  switch (order.status) {
    case 'picking':
      return { ...base, reason: 'picking' };
    case 'picked':
      return { ...base, reason: 'picked' };
    case 'dispatched':
    case 'delivered':
      return { ...base, reason: 'dispatched' };
    case 'cancelled':
      return { ...base, reason: 'cancelled' };
    default:
      return {
        ...base,
        reason: isPickableZohoStatus(order.zohoStatus) ? 'on_list' : 'not_invoiced',
      };
  }
};

/**
 * Say where an order is when it isn't on the New Pick List screen.
 *
 * An order drops off that screen for several unrelated reasons — already
 * picked, not invoiced yet, cancelled, or never synced from Zoho at all — and
 * every one of them looked the same: absent. The screen calls this when a
 * search finds nothing on the list, so the answer is on screen instead of
 * being dug out of Zoho and the database.
 *
 * Looks in the WMS first (sales order, invoice or subject/PCO number), then
 * asks Zoho directly for anything the WMS does not hold, which is what turns a
 * silent sync failure into "in Zoho, not in the WMS".
 *
 * @example
 *   await trpcClient.zohoSalesOrders.whereIs.query({ query: 'PCO-2026-00060' });
 */
const adminWhereIsOrder = wmsOperatorProcedure
  .input(z.object({ query: z.string().trim().min(4) }))
  .query(async ({ input }) => {
    const q = input.query;
    const pattern = `%${q}%`;

    // An invoice number resolves to its sales order through the invoice's
    // reference, which is how Zoho links the two.
    const invoiceRefs = await db
      .select({ referenceNumber: zohoInvoices.referenceNumber })
      .from(zohoInvoices)
      .where(ilike(zohoInvoices.invoiceNumber, pattern))
      .limit(10);
    const refNumbers = invoiceRefs
      .map((row) => row.referenceNumber)
      .filter((ref): ref is string => Boolean(ref));

    const orders = await db
      .select()
      .from(zohoSalesOrders)
      .where(
        or(
          ilike(zohoSalesOrders.salesOrderNumber, pattern),
          ilike(zohoSalesOrders.invoiceNumber, pattern),
          ilike(zohoSalesOrders.referenceNumber, pattern),
          refNumbers.length > 0
            ? inArray(zohoSalesOrders.salesOrderNumber, refNumbers)
            : undefined,
        ),
      )
      .limit(10);

    const pickListIds = orders
      .map((order) => order.pickListId)
      .filter((id): id is string => Boolean(id));
    const pickLists = pickListIds.length
      ? await db
          .select({
            id: wmsPickLists.id,
            pickListNumber: wmsPickLists.pickListNumber,
            completedAt: wmsPickLists.completedAt,
          })
          .from(wmsPickLists)
          .where(inArray(wmsPickLists.id, pickListIds))
      : [];
    const pickListById = new Map(pickLists.map((pl) => [pl.id, pl]));

    const results: Explained[] = orders.map((order) =>
      explainLocal(
        order,
        order.pickListId ? (pickListById.get(order.pickListId) ?? null) : null,
      ),
    );

    if (results.length > 0 || !isZohoConfigured()) {
      return { results };
    }

    /*
      Nothing here, so ask Zoho. Only exact numbers are looked up — Zoho's list
      filters match whole values — which covers what people actually paste:
      an SO, an INV or a PCO/subject reference.
    */
    const upper = q.toUpperCase();
    const found = new Map<string, Explained>();

    const addZohoOrders = async (
      filter: { salesorderNumber?: string; referenceNumber?: string },
      invoiceNumber: string | null,
    ) => {
      const { salesOrders } = await listSalesOrders({ ...filter, perPage: 10 });
      for (const so of salesOrders ?? []) {
        found.set(so.salesorder_number, {
          salesOrderNumber: so.salesorder_number,
          invoiceNumber,
          referenceNumber: so.reference_number ?? null,
          customerName: so.customer_name,
          reason: 'not_synced',
          zohoStatus: so.status,
          pickListNumber: null,
          pickListId: null,
          pickedAt: null,
        });
      }
    };

    try {
      if (/^INV-/.test(upper)) {
        const { invoices } = await listInvoices({ invoiceNumber: upper, perPage: 5 });
        for (const inv of invoices ?? []) {
          if (inv.reference_number) {
            await addZohoOrders({ salesorderNumber: inv.reference_number }, inv.invoice_number);
          }
        }
      } else if (/^SO-/.test(upper)) {
        await addZohoOrders({ salesorderNumber: upper }, null);
      } else {
        await addZohoOrders({ referenceNumber: q }, null);
      }
    } catch (error) {
      console.error('whereIs: Zoho lookup failed', { query: q, error });
    }

    // The search may have missed an order the WMS does hold — an invoice the
    // stale invoice copy never linked, say. Explain those from the WMS rather
    // than calling them unsynced.
    if (found.size > 0) {
      const held = await db
        .select()
        .from(zohoSalesOrders)
        .where(inArray(zohoSalesOrders.salesOrderNumber, [...found.keys()]));
      for (const order of held) {
        const [pickList] = order.pickListId
          ? await db
              .select({
                id: wmsPickLists.id,
                pickListNumber: wmsPickLists.pickListNumber,
                completedAt: wmsPickLists.completedAt,
              })
              .from(wmsPickLists)
              .where(eq(wmsPickLists.id, order.pickListId))
          : [];
        found.set(order.salesOrderNumber, explainLocal(order, pickList ?? null));
      }
    }

    if (found.size === 0) {
      return {
        results: [
          {
            salesOrderNumber: null,
            invoiceNumber: null,
            referenceNumber: null,
            customerName: null,
            reason: 'not_in_zoho' as const,
            zohoStatus: null,
            pickListNumber: null,
            pickListId: null,
            pickedAt: null,
          },
        ],
      };
    }

    return { results: [...found.values()] };
  });

export default adminWhereIsOrder;

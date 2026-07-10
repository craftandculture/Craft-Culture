import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsPickLists,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/** Matches a private-client order reference, e.g. "PCO-2026-00040". */
const PCO_REF = /PCO-\d{4}-\d{5}/;

/**
 * Resolve the private-client order (PCO) behind a pick list, if any.
 *
 * A pick list references its source order via `orderId` / `orderNumber`. For a
 * native PCO pick the `orderNumber` is already `PCO-YYYY-NNNNN`; for a pick
 * released from a Zoho sales order the PCO reference lives in the SO's
 * free-text `reference_number` (subject), e.g. "PCO-2026-00040". This walks
 * either path and returns the matching PCO order, or `null` when nothing
 * resolves — in which case the pick flow shows no label action.
 *
 * @example
 *   await trpcClient.wms.admin.picking.resolvePcoOrder.query({ pickListId });
 */
const adminResolvePcoOrder = wmsOperatorProcedure
  .input(z.object({ pickListId: z.string().uuid() }))
  .query(async ({ input }) => {
    const [pickList] = await db
      .select({
        orderId: wmsPickLists.orderId,
        orderNumber: wmsPickLists.orderNumber,
      })
      .from(wmsPickLists)
      .where(eq(wmsPickLists.id, input.pickListId));

    if (!pickList) return null;

    // 1) Native PCO pick — the pick list's own order number is the PCO ref.
    let pcoNumber = pickList.orderNumber.match(PCO_REF)?.[0] ?? null;

    // 2) Zoho-released pick — read the PCO ref from the SO subject.
    if (!pcoNumber) {
      const [so] = await db
        .select({ referenceNumber: zohoSalesOrders.referenceNumber })
        .from(zohoSalesOrders)
        .where(eq(zohoSalesOrders.id, pickList.orderId));
      pcoNumber = so?.referenceNumber?.match(PCO_REF)?.[0] ?? null;
    }

    if (!pcoNumber) return null;

    const [pco] = await db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
      })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.orderNumber, pcoNumber));

    if (!pco) return null;

    const labelCount = await db.$count(
      privateClientOrderItems,
      eq(privateClientOrderItems.orderId, pco.id),
    );

    return {
      orderId: pco.id,
      orderNumber: pco.orderNumber,
      labelCount,
    };
  });

export default adminResolvePcoOrder;

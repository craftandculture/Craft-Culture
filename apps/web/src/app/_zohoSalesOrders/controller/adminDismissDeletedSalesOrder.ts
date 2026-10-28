/**
 * Dismiss a sales order that no longer exists in Zoho
 *
 * The sync is upsert-only: it writes what Zoho returns and never reconciles
 * what Zoho has stopped returning. Delete an order in Zoho and the local row
 * survives untouched at `synced`/`invoiced` — which is exactly the filter the
 * ready-to-pick queue runs on, so it sits there permanently with no action on
 * the screen able to shift it.
 *
 * This asks Zoho directly rather than trusting the operator or an absence from
 * a paged list. Only a 404 dismisses the order; anything else leaves it alone,
 * because "the network was down" and "the order is gone" must never look the
 * same to a warehouse queue.
 *
 * `already_fulfilled` covers the other permanent resident: an old order that
 * was picked and sent before the warehouse queue existed, or outside it. Zoho
 * still has it (invoiced), so the 404 check can never pass. The operator states
 * it was picked; the order is closed as delivered, with a note, and no stock
 * moves, and any reservation the sync placed is released.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import releaseStockReservations from '@/app/_wms/utils/releaseStockReservations';
import db from '@/database/client';
import { zohoSalesOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import { getSalesOrder } from '@/lib/zoho/salesOrders';

const adminDismissDeletedSalesOrder = wmsOperatorProcedure
  .input(
    z.object({
      salesOrderId: z.string().uuid(),
      reason: z
        .enum(['deleted_in_zoho', 'already_fulfilled'])
        .default('deleted_in_zoho'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { salesOrderId, reason } = input;

    const [order] = await db
      .select()
      .from(zohoSalesOrders)
      .where(eq(zohoSalesOrders.id, salesOrderId));

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Sales order not found',
      });
    }

    /*
      A linked pick holds stock reservations this cannot see. Deleting the pick
      first releases them and resets the order, which is the supported path;
      dismissing underneath it would strand the hold with nothing pointing at
      it — the failure that had bays reading as held with nothing holding them.
    */
    if (order.pickListId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This order still has a pick list. Delete the pick list first, which releases its reserved stock, then dismiss the order.',
      });
    }

    if (order.status !== 'synced') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Only an order still waiting to be released can be dismissed. ${order.salesOrderNumber} is ${order.status}.`,
      });
    }

    if (reason === 'already_fulfilled') {
      const who = ctx.user.name ?? ctx.user.email;
      const note = `Closed — already picked outside the pick queue (by ${who}, ${new Date().toISOString()})`;

      // Any hold the sync placed is let go too: the wine has gone, so nothing
      // should stay reserved against this order.
      const released = await db.transaction(async (tx) => {
        await tx
          .update(zohoSalesOrders)
          .set({
            status: 'delivered',
            notes: order.notes ? `${order.notes}\n${note}` : note,
            updatedAt: new Date(),
          })
          .where(eq(zohoSalesOrders.id, salesOrderId));

        return releaseStockReservations({
          orderType: 'zoho',
          orderId: salesOrderId,
          reason: 'Order already picked outside the pick queue',
          db: tx,
        });
      });

      const releasedNote = released.totalCasesReleased
        ? ` and ${released.totalCasesReleased} reserved case${released.totalCasesReleased === 1 ? '' : 's'} released`
        : '';

      return {
        success: true,
        message: `${order.salesOrderNumber} marked as already picked — removed from the pick queue${releasedNote}`,
      };
    }

    let existsInZoho = false;
    let zohoStatus: string | null = null;

    try {
      const salesOrder = await getSalesOrder(order.zohoSalesOrderId);
      existsInZoho = Boolean(salesOrder);
      zohoStatus = salesOrder?.status ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Only a 404 is proof of deletion. A timeout, a refused token or a 500
      // means we do not know, and not knowing must not remove a live order.
      if (!/\b404\b/.test(message)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Could not confirm with Zoho whether ${order.salesOrderNumber} still exists, so it has been left alone. ${message}`,
        });
      }
    }

    if (existsInZoho) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          `${order.salesOrderNumber} still exists in Zoho${zohoStatus ? ` (${zohoStatus})` : ''}. ` +
          'Void or cancel it in Zoho and re-sync — dismissing it here would hide a live order.',
      });
    }

    const note = `Dismissed — no longer exists in Zoho (checked ${new Date().toISOString()})`;

    /*
      The sync held this order's stock the moment it arrived. Cancelling the
      row without giving those cases back left them reserved against an order
      that no longer exists, with nothing on screen able to clear them.
    */
    const released = await db.transaction(async (tx) => {
      await tx
        .update(zohoSalesOrders)
        .set({
          status: 'cancelled',
          notes: order.notes ? `${order.notes}\n${note}` : note,
          updatedAt: new Date(),
        })
        .where(eq(zohoSalesOrders.id, salesOrderId));

      return releaseStockReservations({
        orderType: 'zoho',
        orderId: salesOrderId,
        reason: 'Order deleted in Zoho',
        db: tx,
      });
    });

    const releasedNote = released.totalCasesReleased
      ? ` and ${released.totalCasesReleased} reserved case${released.totalCasesReleased === 1 ? '' : 's'} released`
      : '';

    return {
      success: true,
      message: `${order.salesOrderNumber} was deleted in Zoho — removed from the pick queue${releasedNote}`,
    };
  });

export default adminDismissDeletedSalesOrder;

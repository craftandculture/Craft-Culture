import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  sourcePurchaseOrderItems,
  sourcePurchaseOrders,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const itemConfirmationSchema = z.object({
  itemId: z.string().uuid(),
  confirmed: z.boolean(),
  rejectionReason: z.string().optional(),
});

const confirmPurchaseOrderSchema = z.object({
  poId: z.string().uuid(),
  items: z.array(itemConfirmationSchema).min(1),
  notes: z.string().optional(),
});

/**
 * Confirm Purchase Order items as a partner
 *
 * - Updates each item's status to 'confirmed' or 'rejected'
 * - Updates overall PO status based on item statuses
 * - Sends notification to admin
 *
 * @example
 *   await trpcClient.source.partner.confirmPurchaseOrder.mutate({
 *     poId: "uuid",
 *     items: [
 *       { itemId: "uuid1", confirmed: true },
 *       { itemId: "uuid2", confirmed: false, rejectionReason: "Out of stock" }
 *     ],
 *     notes: "Item 2 is unavailable, sorry"
 *   });
 */
const partnerConfirmPurchaseOrder = winePartnerProcedure
  .input(confirmPurchaseOrderSchema)
  .mutation(async ({ input, ctx }) => {
    const { poId, items, notes } = input;
    const partnerId = ctx.partnerId;
    const userId = ctx.user.id;

    // 1. Get the PO (must belong to this partner)
    const [po] = await db
      .select()
      .from(sourcePurchaseOrders)
      .where(
        and(
          eq(sourcePurchaseOrders.id, poId),
          eq(sourcePurchaseOrders.partnerId, partnerId)
        )
      );

    if (!po) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Purchase Order not found',
      });
    }

    // 2. Verify PO is in 'sent' status
    if (po.status !== 'sent') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `PO cannot be confirmed from status '${po.status}'. Only sent POs can be confirmed.`,
      });
    }

    // 3. Get all PO items
    const poItems = await db
      .select()
      .from(sourcePurchaseOrderItems)
      .where(eq(sourcePurchaseOrderItems.poId, poId));

    // 4. Verify all submitted items belong to this PO
    const poItemIds = new Set(poItems.map((item) => item.id));
    const submittedItemIds = items.map((item) => item.itemId);

    for (const itemId of submittedItemIds) {
      if (!poItemIds.has(itemId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Item ${itemId} does not belong to this PO`,
        });
      }
    }

    // 5. Check all items are being confirmed
    if (submittedItemIds.length !== poItems.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `All ${poItems.length} items must be confirmed or rejected. Received ${submittedItemIds.length}.`,
      });
    }

    // 6. Update each item's status
    const confirmedItems: string[] = [];
    const rejectedItems: string[] = [];
    const now = new Date();

    for (const item of items) {
      const status = item.confirmed ? 'confirmed' : 'rejected';

      await db
        .update(sourcePurchaseOrderItems)
        .set({
          status,
          confirmedAt: now,
          rejectionReason: item.confirmed ? null : item.rejectionReason,
        })
        .where(eq(sourcePurchaseOrderItems.id, item.itemId));

      if (item.confirmed) {
        confirmedItems.push(item.itemId);
      } else {
        rejectedItems.push(item.itemId);
      }
    }

    // 7. Calculate overall PO status
    let poStatus: 'confirmed' | 'partially_confirmed' | 'cancelled';

    if (confirmedItems.length === poItems.length) {
      poStatus = 'confirmed';
    } else if (rejectedItems.length === poItems.length) {
      poStatus = 'cancelled';
    } else {
      poStatus = 'partially_confirmed';
    }

    // 8. Calculate confirmed total
    const confirmedItemsData = poItems.filter((item) =>
      confirmedItems.includes(item.id)
    );
    const confirmedTotalUsd = confirmedItemsData.reduce(
      (sum, item) => sum + (item.lineTotalUsd ?? 0),
      0
    );

    // 9. Update PO status
    const [updatedPo] = await db
      .update(sourcePurchaseOrders)
      .set({
        status: poStatus,
        confirmedAt: now,
        confirmedBy: userId,
        confirmationNotes: notes,
      })
      .where(eq(sourcePurchaseOrders.id, poId))
      .returning();

    if (!updatedPo) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm Purchase Order',
      });
    }

    // TODO: Send notification to admin about confirmation

    return {
      id: updatedPo.id,
      poNumber: updatedPo.poNumber,
      status: updatedPo.status,
      confirmedAt: updatedPo.confirmedAt,
      summary: {
        totalItems: poItems.length,
        confirmedItems: confirmedItems.length,
        rejectedItems: rejectedItems.length,
        confirmedTotalUsd,
      },
      message:
        poStatus === 'confirmed'
          ? 'All items confirmed'
          : poStatus === 'partially_confirmed'
            ? `${confirmedItems.length} of ${poItems.length} items confirmed`
            : 'All items rejected - order cancelled',
    };
  });

export default partnerConfirmPurchaseOrder;

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourcePurchaseOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const confirmPurchaseOrderSchema = z.object({
  poId: z.string().uuid(),
  estimatedDeliveryDate: z.date().optional(),
  confirmationNotes: z.string().optional(),
});

/**
 * Confirm a Purchase Order as a partner
 *
 * - Updates PO status from 'sent' to 'confirmed'
 * - Records confirmation timestamp and optional notes
 * - Optionally sets estimated delivery date
 *
 * @example
 *   await trpcClient.source.partner.confirmPurchaseOrder.mutate({
 *     poId: "uuid",
 *     estimatedDeliveryDate: new Date("2026-02-15"),
 *     confirmationNotes: "Will ship next week"
 *   });
 */
const partnerConfirmPurchaseOrder = winePartnerProcedure
  .input(confirmPurchaseOrderSchema)
  .mutation(async ({ input, ctx }) => {
    const { poId, estimatedDeliveryDate, confirmationNotes } = input;
    const partnerId = ctx.partnerId;
    const userId = ctx.user.id;

    // Get the PO (must belong to this partner)
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

    // Verify PO is in 'sent' status
    if (po.status !== 'sent') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `PO cannot be confirmed from status '${po.status}'. Only sent POs can be confirmed.`,
      });
    }

    // Update PO status to 'confirmed'
    const [updatedPo] = await db
      .update(sourcePurchaseOrders)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userId,
        estimatedDeliveryDate,
        confirmationNotes,
      })
      .where(eq(sourcePurchaseOrders.id, poId))
      .returning();

    if (!updatedPo) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm Purchase Order',
      });
    }

    return {
      id: updatedPo.id,
      poNumber: updatedPo.poNumber,
      status: updatedPo.status,
      confirmedAt: updatedPo.confirmedAt,
      estimatedDeliveryDate: updatedPo.estimatedDeliveryDate,
      message: 'Purchase Order confirmed successfully',
    };
  });

export default partnerConfirmPurchaseOrder;

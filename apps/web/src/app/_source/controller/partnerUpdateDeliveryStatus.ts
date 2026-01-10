import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourcePurchaseOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const updateDeliveryStatusSchema = z.object({
  poId: z.string().uuid(),
  action: z.enum(['ship', 'deliver']),
  trackingNumber: z.string().optional(),
  shippingNotes: z.string().optional(),
  deliveryNotes: z.string().optional(),
});

/**
 * Update delivery status of a Purchase Order
 *
 * Partners can:
 * - Mark as 'shipped' with tracking number (from 'confirmed')
 * - Mark as 'delivered' (from 'shipped')
 *
 * @example
 *   // Mark as shipped
 *   await trpcClient.source.partner.updateDeliveryStatus.mutate({
 *     poId: "uuid",
 *     action: "ship",
 *     trackingNumber: "DHL-123456",
 *     shippingNotes: "2 cases on pallet"
 *   });
 *
 *   // Mark as delivered
 *   await trpcClient.source.partner.updateDeliveryStatus.mutate({
 *     poId: "uuid",
 *     action: "deliver",
 *     deliveryNotes: "Signed by warehouse manager"
 *   });
 */
const partnerUpdateDeliveryStatus = winePartnerProcedure
  .input(updateDeliveryStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { poId, action, trackingNumber, shippingNotes, deliveryNotes } = input;
    const partnerId = ctx.partnerId;

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

    // Validate action based on current status
    if (action === 'ship') {
      if (po.status !== 'confirmed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `PO cannot be shipped from status '${po.status}'. Only confirmed POs can be shipped.`,
        });
      }

      // Update to shipped
      const [updatedPo] = await db
        .update(sourcePurchaseOrders)
        .set({
          status: 'shipped',
          shippedAt: new Date(),
          trackingNumber,
          shippingNotes,
        })
        .where(eq(sourcePurchaseOrders.id, poId))
        .returning();

      if (!updatedPo) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update Purchase Order',
        });
      }

      return {
        id: updatedPo.id,
        poNumber: updatedPo.poNumber,
        status: updatedPo.status,
        shippedAt: updatedPo.shippedAt,
        trackingNumber: updatedPo.trackingNumber,
        message: 'Purchase Order marked as shipped',
      };
    }

    if (action === 'deliver') {
      if (po.status !== 'shipped') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `PO cannot be marked delivered from status '${po.status}'. Only shipped POs can be marked as delivered.`,
        });
      }

      // Update to delivered
      const [updatedPo] = await db
        .update(sourcePurchaseOrders)
        .set({
          status: 'delivered',
          deliveredAt: new Date(),
          deliveryNotes,
        })
        .where(eq(sourcePurchaseOrders.id, poId))
        .returning();

      if (!updatedPo) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update Purchase Order',
        });
      }

      return {
        id: updatedPo.id,
        poNumber: updatedPo.poNumber,
        status: updatedPo.status,
        deliveredAt: updatedPo.deliveredAt,
        message: 'Purchase Order marked as delivered',
      };
    }

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid action',
    });
  });

export default partnerUpdateDeliveryStatus;

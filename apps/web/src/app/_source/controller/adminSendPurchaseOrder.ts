import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourcePurchaseOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import notifyPartnerOfPo from '../utils/notifyPartnerOfPo';

const sendPurchaseOrderSchema = z.object({
  poId: z.string().uuid(),
});

/**
 * Send a Purchase Order to the partner
 *
 * - Updates PO status from 'draft' to 'sent'
 * - Records sent timestamp and user
 * - Sends notification to partner (email + in-app)
 *
 * @example
 *   await trpcClient.source.admin.sendPurchaseOrder.mutate({
 *     poId: "uuid"
 *   });
 */
const adminSendPurchaseOrder = adminProcedure
  .input(sendPurchaseOrderSchema)
  .mutation(async ({ input, ctx }) => {
    const { poId } = input;
    const userId = ctx.user.id;

    // 1. Get the PO
    const [po] = await db
      .select()
      .from(sourcePurchaseOrders)
      .where(eq(sourcePurchaseOrders.id, poId));

    if (!po) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Purchase Order not found',
      });
    }

    // 2. Verify PO is in draft status
    if (po.status !== 'draft') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `PO cannot be sent from status '${po.status}'. Only draft POs can be sent.`,
      });
    }

    // 3. Update PO status to 'sent'
    const [updatedPo] = await db
      .update(sourcePurchaseOrders)
      .set({
        status: 'sent',
        sentAt: new Date(),
        sentBy: userId,
      })
      .where(eq(sourcePurchaseOrders.id, poId))
      .returning();

    if (!updatedPo) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update Purchase Order',
      });
    }

    // 4. Send notification to partner
    await notifyPartnerOfPo({
      poId,
      partnerId: po.partnerId,
    });

    return {
      id: updatedPo.id,
      poNumber: updatedPo.poNumber,
      status: updatedPo.status,
      sentAt: updatedPo.sentAt,
      message: 'Purchase Order sent successfully',
    };
  });

export default adminSendPurchaseOrder;

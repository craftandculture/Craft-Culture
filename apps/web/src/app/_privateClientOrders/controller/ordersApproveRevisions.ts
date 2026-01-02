import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const approveRevisionsSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Approve revisions made by C&C admin
 *
 * When C&C requests revisions and makes changes to the order,
 * the partner can review and approve those changes.
 * This resubmits the order for final C&C approval.
 */
const ordersApproveRevisions = winePartnerProcedure
  .input(approveRevisionsSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId } = input;
    const { partnerId, user } = ctx;

    // Fetch the order
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, partnerId },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not owned by you',
      });
    }

    // Validate current status allows approving revisions
    if (order.status !== 'revision_requested') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot approve revisions for order with status "${order.status}". Order must be in revision_requested status.`,
      });
    }

    const previousStatus = order.status;
    const newStatus = 'submitted';

    // Update order status back to submitted
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: newStatus,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'revisions_approved',
      previousStatus,
      newStatus,
      notes: 'Partner approved C&C revisions',
    });

    return updatedOrder;
  });

export default ordersApproveRevisions;

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { privateClientOrderStatusEnum } from '../schemas/getOrdersSchema';
import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: privateClientOrderStatusEnum,
});

/**
 * Map order status to partner notification type
 */
const getPartnerNotificationType = (status: string) => {
  const statusToNotification: Record<string, 'approved' | 'revision_requested' | 'verification_required' | 'client_verified' | 'verification_failed' | 'delivery_scheduled' | 'delivered' | 'stock_received' | null> = {
    cc_approved: 'approved',
    revision_requested: 'revision_requested',
    awaiting_client_verification: 'verification_required',
    client_verified: 'client_verified',
    verification_failed: 'verification_failed',
    delivery_scheduled: 'delivery_scheduled',
    delivered: 'delivered',
  };
  return statusToNotification[status] ?? null;
};

/**
 * Update the status of a private client order
 *
 * Admins can update the status of any order.
 * Triggers appropriate notifications based on the new status.
 */
const adminUpdateStatus = adminProcedure
  .input(updateStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, status } = input;
    const { user } = ctx;

    // Fetch full order details
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    const previousStatus = order.status;

    // Update the order status
    const [updated] = await db
      .update(privateClientOrders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      action: 'status_changed',
      previousStatus,
      newStatus: status,
      notes: `Admin changed status from ${previousStatus} to ${status}`,
    });

    // Send partner notification if applicable
    const notificationType = getPartnerNotificationType(status);

    logger.info('PCO: adminUpdateStatus notification check', {
      orderId,
      status,
      notificationType,
      partnerId: order.partnerId,
      hasPartnerId: !!order.partnerId,
      hasNotificationType: !!notificationType,
    });

    if (notificationType && order.partnerId) {
      logger.info('PCO: Sending partner notification from adminUpdateStatus', {
        orderId,
        status,
        notificationType,
        partnerId: order.partnerId,
      });

      try {
        await notifyPartnerOfOrderUpdate({
          orderId,
          orderNumber: updated?.orderNumber ?? order.orderNumber ?? orderId,
          partnerId: order.partnerId,
          type: notificationType,
          totalAmount: order.totalUsd ?? 0,
          clientName: order.clientName ?? 'Client',
          revisionReason: notificationType === 'revision_requested' ? 'Please review and update the order details.' : undefined,
        });
        logger.info('PCO: Partner notification sent successfully', { orderId, notificationType });
      } catch (error) {
        logger.error('PCO: Failed to send partner notification', {
          orderId,
          notificationType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger.warn('PCO: Skipping partner notification', {
        orderId,
        status,
        reason: !notificationType ? 'no notification type for this status' : 'no partnerId on order',
      });
    }

    return updated;
  });

export default adminUpdateStatus;

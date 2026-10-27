import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import releaseStockReservations from '@/app/_wms/utils/releaseStockReservations';
import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { privateClientOrderStatusEnum } from '../schemas/getOrdersSchema';
import assertDistributorSku from '../utils/assertDistributorSku';
import ensureClientVerified from '../utils/ensureClientVerified';
import notifyPartnerOfOrderUpdate from '../utils/notifyPartnerOfOrderUpdate';
import isRoutinePcoTransition from '../utils/pcoStatusTransitions';

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: privateClientOrderStatusEnum,
  /**
   * Set once the admin has confirmed a change outside the normal steps
   * (backwards, several stages at once, reopening a closed order)
   */
  override: z.boolean().optional(),
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
    const { orderId, status, override } = input;
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
    const isRoutine = isRoutinePcoTransition(previousStatus, status);

    /*
      A one-click move to any status used to be possible, from delivered back
      to draft or straight past payment. Normal next steps go through; anything
      else has to be confirmed as a correction first.
    */
    if (!isRoutine && !override) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Moving this order from "${previousStatus}" to "${status}" skips or reverses the normal steps. Confirm the change to make it anyway.`,
      });
    }

    // Checked before the update: the distributor SKU must exist once paid
    if (status === 'client_paid' && previousStatus !== 'client_paid') {
      await assertDistributorSku(orderId);
    }

    // Update the order status, unless someone else moved it a moment ago
    const [updated] = await db
      .update(privateClientOrders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(privateClientOrders.id, orderId), eq(privateClientOrders.status, previousStatus)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'The order changed while you were updating it. Refresh and try again.',
      });
    }

    /*
     * LEGACY CLEANUP. Approving a PCO no longer reserves WMS stock — the PCO
     * module is standalone and the WMS is the source of truth — so no new
     * reservation can appear here. Orders approved before that change may still
     * be holding cases, and these two calls hand them back as the order moves
     * on. Both are a no-op once the backlog is clear; keep them until it is.
     */

    // Release stock reservations on cancellation
    if (status === 'cancelled') {
      await releaseStockReservations({
        orderId,
        orderType: 'pco',
        reason: 'Order cancelled',
        db,
      });
    }

    /*
     * Legacy cleanup, as above: hand back any pre-existing hold once the order
     * reaches a stage where the stock has physically left. Returns the held
     * cases to availableCases and leaves the total on-hand count unchanged.
     */
    const stockDepartedStatuses = [
      'stock_in_transit',
      'with_distributor',
      'out_for_delivery',
      'delivered',
    ];
    if (stockDepartedStatuses.includes(status)) {
      await releaseStockReservations({
        orderId,
        orderType: 'pco',
        reason: `Reservation released on '${status}' (fulfilled outside WMS dispatch)`,
        db,
      });
    }

    // Ensure client contact is marked as CD-verified on delivery
    if (status === 'delivered') {
      await ensureClientVerified(order.clientId);
    }

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      action: 'status_changed',
      previousStatus,
      newStatus: status,
      notes: `Admin changed status from ${previousStatus} to ${status}${isRoutine ? '' : ' (confirmed as a correction)'}`,
      ...(!isRoutine && { metadata: { correction: true } }),
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

    /*
      No Zoho invoice is raised here. PCOs are invoiced by hand, line by line,
      once delivered (Manual invoicing), and the zoho-create-invoice job never
      produced a valid invoice, so switching it on would now double-invoice.
    */

    return updated;
  });

export default adminUpdateStatus;

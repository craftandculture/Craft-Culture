import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  partnerMembers,
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const partnerVerificationSchema = z.object({
  orderId: z.string().uuid(),
  response: z.enum(['yes', 'no', 'dont_know']),
});

/**
 * Partner responds to client verification prompt
 *
 * When a distributor requires client verification (e.g., City Drinks),
 * the partner is asked "Is client verified with [Distributor]?"
 * - YES: Proceed to distributor verification
 * - NO/DON'T KNOW: Order suspended, partner needs to resolve
 */
const ordersPartnerVerification = winePartnerProcedure
  .input(partnerVerificationSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, response } = input;
    const { partnerId, user } = ctx;

    // Fetch the order with distributor info
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, partnerId },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not owned by you',
      });
    }

    // Validate current status
    if (order.status !== 'awaiting_partner_verification') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot verify for order with status "${order.status}". Order must be awaiting partner verification.`,
      });
    }

    if (!order.distributorId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Order has no distributor assigned',
      });
    }

    // Get distributor info
    const distributor = await db.query.partners.findFirst({
      where: { id: order.distributorId },
      columns: { id: true, businessName: true, distributorCode: true },
    });

    const previousStatus = order.status;
    const newStatus =
      response === 'yes'
        ? 'awaiting_distributor_verification'
        : 'verification_suspended';

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: newStatus,
        partnerVerificationResponse: response,
        partnerVerificationAt: new Date(),
        partnerVerificationBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'partner_verification',
      previousStatus,
      newStatus,
      notes:
        response === 'yes'
          ? 'Partner confirmed client is verified with distributor'
          : `Partner responded "${response}" to client verification`,
      metadata: { verificationResponse: response },
    });

    // Send notifications based on response
    if (response === 'yes') {
      // Notify distributor to verify client in their system
      const distributorMembers = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.distributorId));

      for (const member of distributorMembers) {
        await createNotification({
          userId: member.userId,
          type: 'action_required',
          title: 'Client Verification Required',
          message: `Please verify client for order ${updatedOrder?.orderNumber ?? orderId} in your system.`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/distributor/orders/${orderId}`,
        });
      }
    } else {
      // Order suspended - notify other partner members about the suspension
      // Notify partner members about suspended order
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, partnerId));

      for (const member of partnerMembersList) {
        if (member.userId !== user.id) {
          // Don't notify the user who just took the action
          await createNotification({
            userId: member.userId,
            type: 'status_update',
            title: 'Order Verification Suspended',
            message: `Order ${updatedOrder?.orderNumber ?? orderId} is suspended pending client verification with ${distributor?.businessName ?? 'distributor'}.`,
            entityType: 'private_client_order',
            entityId: orderId,
            actionUrl: `/platform/private-orders/${orderId}`,
          });
        }
      }
    }

    return updatedOrder;
  });

export default ordersPartnerVerification;

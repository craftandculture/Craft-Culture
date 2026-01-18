import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import notifyDistributorOfOrderUpdate from '../utils/notifyDistributorOfOrderUpdate';

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
      await notifyDistributorOfOrderUpdate({
        orderId,
        orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
        distributorId: order.distributorId,
        type: 'verification_required',
        clientName: order.clientName ?? undefined,
        clientEmail: order.clientEmail ?? undefined,
        clientPhone: order.clientPhone ?? undefined,
      });
    }
    // Note: When response is 'no' or 'dont_know', order is suspended
    // Partner members are already aware since their colleague initiated this

    return updatedOrder;
  });

export default ordersPartnerVerification;

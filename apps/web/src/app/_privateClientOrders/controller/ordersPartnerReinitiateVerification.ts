import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import notifyDistributorOfOrderUpdate from '../utils/notifyDistributorOfOrderUpdate';

const reinitiateSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Partner re-initiates verification for a suspended order
 *
 * When an order is in verification_suspended status, the partner
 * can re-initiate verification once their client has registered
 * with the distributor. This moves the order to awaiting_distributor_verification
 * for the distributor to confirm.
 */
const ordersPartnerReinitiateVerification = winePartnerProcedure
  .input(reinitiateSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, notes } = input;
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

    // Validate current status
    if (order.status !== 'verification_suspended') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot re-initiate verification for order with status "${order.status}". Order must be in verification suspended status.`,
      });
    }

    if (!order.distributorId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Order has no distributor assigned',
      });
    }

    const previousStatus = order.status;
    const newStatus = 'awaiting_distributor_verification' as const;

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        status: newStatus,
        partnerVerificationResponse: 'yes',
        partnerVerificationAt: new Date(),
        partnerVerificationBy: user.id,
        // Clear previous distributor verification
        distributorVerificationResponse: null,
        distributorVerificationAt: null,
        distributorVerificationBy: null,
        distributorVerificationNotes: null,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'verification_reinitiated',
      previousStatus,
      newStatus,
      notes: notes ?? 'Partner re-initiated verification after client registered with distributor',
      metadata: { reinitiatedBy: 'partner' },
    });

    // Notify distributor to verify client (in-app + email)
    await notifyDistributorOfOrderUpdate({
      orderId,
      orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
      distributorId: order.distributorId,
      type: 'verification_required',
      clientName: order.clientName ?? undefined,
      clientEmail: order.clientEmail ?? undefined,
      clientPhone: order.clientPhone ?? undefined,
    });

    return updatedOrder;
  });

export default ordersPartnerReinitiateVerification;

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
import { adminProcedure } from '@/lib/trpc/procedures';

const adminMarkPartnerPaidSchema = z.object({
  orderId: z.string().uuid(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Admin mark C&C payment to partner
 *
 * Independent admin action to mark that C&C has paid the wine partner
 * for their stock. This does NOT affect the order status - it's purely
 * for tracking the payment from C&C to the partner.
 */
const adminMarkPartnerPaid = adminProcedure
  .input(adminMarkPartnerPaidSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, reference, notes } = input;
    const { user } = ctx;

    // Get order details
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
      columns: {
        id: true,
        orderNumber: true,
        partnerId: true,
        partnerPaidAt: true,
        status: true,
      },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Check if already paid
    if (order.partnerPaidAt) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Partner payment already recorded',
      });
    }

    const now = new Date();

    // Update order with partner payment info (NOT changing status)
    await db
      .update(privateClientOrders)
      .set({
        partnerPaidAt: now,
        partnerPaymentConfirmedBy: user.id,
        partnerPaymentReference: reference ?? null,
        updatedAt: now,
      })
      .where(eq(privateClientOrders.id, orderId));

    // Log activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId: order.partnerId,
      action: 'cc_paid_partner',
      notes: notes ?? 'C&C paid partner for stock',
      metadata: {
        reference,
        paidAt: now.toISOString(),
      },
    });

    // Notify partner members
    if (order.partnerId) {
      const partnerMembersList = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, order.partnerId));

      const orderRef = order.orderNumber ?? orderId;

      for (const member of partnerMembersList) {
        await createNotification({
          userId: member.userId,
          type: 'status_update',
          title: 'Payment Received from C&C',
          message: `C&C has processed payment for order ${orderRef}${reference ? ` (Ref: ${reference})` : ''}`,
          entityType: 'private_client_order',
          entityId: orderId,
          actionUrl: `/platform/private-orders/${orderId}`,
        });
      }
    }

    return {
      success: true,
      partnerPaidAt: now.toISOString(),
      reference,
    };
  });

export default adminMarkPartnerPaid;

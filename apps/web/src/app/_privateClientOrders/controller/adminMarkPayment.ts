import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const adminMarkPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentStage: z.enum(['client', 'distributor']),
  reference: z.string().optional(),
});

/**
 * Admin mark a payment as paid without changing order status
 *
 * Allows admins to record client or distributor payments at any stage.
 * Does NOT affect the order status — purely for payment tracking.
 */
const adminMarkPayment = adminProcedure
  .input(adminMarkPaymentSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId, paymentStage, reference } = input;
    const { user } = ctx;

    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
      columns: {
        id: true,
        orderNumber: true,
        clientPaidAt: true,
        distributorPaidAt: true,
        status: true,
      },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    const now = new Date();

    if (paymentStage === 'client') {
      if (order.clientPaidAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Client payment already recorded',
        });
      }

      await db
        .update(privateClientOrders)
        .set({
          clientPaidAt: now,
          clientPaymentConfirmedBy: user.id,
          clientPaymentReference: reference ?? null,
          updatedAt: now,
        })
        .where(eq(privateClientOrders.id, orderId));
    } else {
      if (order.distributorPaidAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Distributor payment already recorded',
        });
      }

      await db
        .update(privateClientOrders)
        .set({
          distributorPaidAt: now,
          distributorPaymentConfirmedBy: user.id,
          distributorPaymentReference: reference ?? null,
          updatedAt: now,
        })
        .where(eq(privateClientOrders.id, orderId));
    }

    // Log activity
    const actionLabel = paymentStage === 'client'
      ? 'client_payment_confirmed'
      : 'distributor_payment_confirmed';

    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      action: actionLabel,
      notes: `${paymentStage === 'client' ? 'Client' : 'Distributor'} payment marked as paid by admin`,
      metadata: {
        reference,
        paidAt: now.toISOString(),
      },
    });

    return {
      success: true,
      paymentStage,
      paidAt: now.toISOString(),
      reference,
    };
  });

export default adminMarkPayment;

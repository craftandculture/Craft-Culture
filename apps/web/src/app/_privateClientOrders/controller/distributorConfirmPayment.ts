import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

import { DELIVERY_STAGE_STATUSES } from '../constants';

/**
 * Record the distributor's payment to C&C once delivery is under way
 *
 * Sets the payment date without changing the order's status, so the delivery
 * flow carries on where it is.
 */
const distributorConfirmPayment = distributorProcedure
  .input(z.object({ orderId: z.string().uuid(), reference: z.string().trim().max(200).optional() }))
  .mutation(async ({ input, ctx: { partnerId, user } }) => {
    const now = new Date();

    const [updated] = await db
      .update(privateClientOrders)
      .set({
        distributorPaidAt: now,
        distributorPaymentConfirmedBy: user.id,
        distributorPaymentReference: input.reference || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(privateClientOrders.id, input.orderId),
          eq(privateClientOrders.distributorId, partnerId),
          inArray(privateClientOrders.status, [...DELIVERY_STAGE_STATUSES]),
          isNull(privateClientOrders.distributorPaidAt),
        ),
      )
      .returning({ id: privateClientOrders.id, status: privateClientOrders.status });

    if (!updated) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Payment to Craft & Culture is already recorded, or this order is not at the delivery stage',
      });
    }

    await db.insert(privateClientOrderActivityLogs).values({
      orderId: input.orderId,
      userId: user.id,
      partnerId,
      action: 'distributor_payment_confirmed',
      notes: 'Payment to Craft & Culture confirmed by the distributor',
      metadata: { reference: input.reference, paidAt: now.toISOString(), status: updated.status },
    });

    return { success: true, paidAt: now.toISOString() };
  });

export default distributorConfirmPayment;

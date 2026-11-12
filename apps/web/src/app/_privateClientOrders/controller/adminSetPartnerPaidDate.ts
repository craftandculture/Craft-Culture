import { TRPCError } from '@trpc/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import paymentDateFromDay from '../utils/paymentDateFromDay';

/**
 * Correct the date C&C paid the wine partner on an order already marked paid
 *
 * Marking paid used to stamp the day it was recorded, so orders paid weeks
 * earlier and recorded later all read as paid on the recording day — and
 * stopped matching the partner's statement and Zoho. Only the date moves; the
 * reference and who recorded it stay, and the change is logged.
 */
const adminSetPartnerPaidDate = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      paidOn: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const paidAt = paymentDateFromDay(input.paidOn);
    if (!paidAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pick the day the payment was made (not in the future)',
      });
    }

    const order = await db.query.privateClientOrders.findFirst({
      where: { id: input.orderId },
      columns: { id: true, partnerId: true, partnerPaidAt: true },
    });
    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    if (!order.partnerPaidAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order has no partner payment yet: use Mark paid',
      });
    }

    await db
      .update(privateClientOrders)
      .set({ partnerPaidAt: paidAt, updatedAt: new Date() })
      .where(and(eq(privateClientOrders.id, input.orderId), isNotNull(privateClientOrders.partnerPaidAt)));

    await db.insert(privateClientOrderActivityLogs).values({
      orderId: input.orderId,
      userId: ctx.user.id,
      partnerId: order.partnerId,
      action: 'cc_paid_partner_date_changed',
      notes: `Partner payment date changed from ${order.partnerPaidAt.toISOString().slice(0, 10)} to ${input.paidOn}`,
      metadata: { from: order.partnerPaidAt.toISOString(), to: paidAt.toISOString() },
    });

    return { success: true, partnerPaidAt: paidAt.toISOString() };
  });

export default adminSetPartnerPaidDate;

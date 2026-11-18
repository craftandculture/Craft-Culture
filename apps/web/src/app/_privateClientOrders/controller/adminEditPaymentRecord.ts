import { TRPCError } from '@trpc/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import paymentDateFromDay from '../utils/paymentDateFromDay';

/**
 * Correct the date and reference of a payment already recorded on an order
 *
 * The distributor's payment to C&C was stamped with the day someone pressed
 * Confirm received, and its reference could only be typed then. Payments are
 * often recorded days later, or the reference arrives after the money, so the
 * order stopped matching the bank and Zoho with no way to put it right. Either
 * recorded payment (distributor → C&C, C&C → partner) can now be moved to the
 * day it was made and given its reference. Who recorded it stays; the change
 * is logged.
 *
 * @example
 *   await trpcClient.privateClientOrders.adminEditPaymentRecord.mutate({
 *     orderId, stage: 'distributor', paidOn: '2026-11-16', reference: '5000000752048030',
 *   });
 */
const adminEditPaymentRecord = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      stage: z.enum(['distributor', 'partner']),
      paidOn: z.string(),
      /** Empty clears it */
      reference: z.string().max(200),
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
      columns: {
        id: true,
        partnerId: true,
        distributorPaidAt: true,
        distributorPaymentReference: true,
        partnerPaidAt: true,
        partnerPaymentReference: true,
      },
    });
    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    const isDistributor = input.stage === 'distributor';
    const before = isDistributor
      ? { at: order.distributorPaidAt, ref: order.distributorPaymentReference }
      : { at: order.partnerPaidAt, ref: order.partnerPaymentReference };
    if (!before.at) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: isDistributor
          ? 'This order has no distributor payment yet: use Confirm received'
          : 'This order has no partner payment yet: use Mark paid',
      });
    }

    const reference = input.reference.trim() || null;
    const paidColumn = isDistributor ? privateClientOrders.distributorPaidAt : privateClientOrders.partnerPaidAt;

    await db
      .update(privateClientOrders)
      .set(
        isDistributor
          ? { distributorPaidAt: paidAt, distributorPaymentReference: reference, updatedAt: new Date() }
          : { partnerPaidAt: paidAt, partnerPaymentReference: reference, updatedAt: new Date() },
      )
      .where(and(eq(privateClientOrders.id, input.orderId), isNotNull(paidColumn)));

    const who = isDistributor ? 'Distributor payment' : 'Partner payment';
    const changes = [
      before.at.toISOString().slice(0, 10) !== input.paidOn
        ? `date ${before.at.toISOString().slice(0, 10)} → ${input.paidOn}`
        : null,
      (before.ref ?? null) !== reference ? `reference ${before.ref ?? '(none)'} → ${reference ?? '(none)'}` : null,
    ].filter(Boolean);

    if (changes.length > 0) {
      await db.insert(privateClientOrderActivityLogs).values({
        orderId: input.orderId,
        userId: ctx.user.id,
        partnerId: order.partnerId,
        action: isDistributor ? 'distributor_payment_edited' : 'cc_paid_partner_date_changed',
        notes: `${who} corrected: ${changes.join(', ')}`,
        metadata: {
          from: { paidAt: before.at.toISOString(), reference: before.ref },
          to: { paidAt: paidAt.toISOString(), reference },
        },
      });
    }

    return { success: true };
  });

export default adminEditPaymentRecord;

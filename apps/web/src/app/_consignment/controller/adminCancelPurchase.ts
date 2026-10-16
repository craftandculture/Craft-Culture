import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyPurchaseUpdate from '../utils/notifyPurchaseUpdate';
import releasePurchaseHolds from '../utils/releasePurchaseHolds';

/**
 * Close a purchase that is not going to happen
 *
 * For the money that never arrived, the reservation somebody asked to extend
 * and then did not use, and the order placed by mistake. Refused once ownership
 * has moved: that is a sale, and reversing it means selling the wine back
 * rather than deleting the record of it.
 */
const adminCancelPurchase = staffAdminProcedure
  .input(
    z.object({
      purchaseId: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [purchase] = await db
      .select()
      .from(cellarPurchases)
      .where(eq(cellarPurchases.id, input.purchaseId))
      .limit(1);

    if (!purchase) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
    }

    if (purchase.status === 'completed') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'The wine has already been transferred. Move it back with an ownership transfer rather than cancelling the record.',
      });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      /*
        Closed first, and only from an open state, so a cancel that lands as
        the payment is confirmed cannot reopen the hold under a completed sale.
      */
      const [closed] = await tx
        .update(cellarPurchases)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          notes: input.reason ?? purchase.notes,
          updatedAt: now,
        })
        .where(
          and(
            eq(cellarPurchases.id, purchase.id),
            inArray(cellarPurchases.status, ['reserved', 'payment_claimed']),
          ),
        )
        .returning({ id: cellarPurchases.id });

      if (!closed) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This purchase has changed. Please refresh to see where it stands.',
        });
      }

      await releasePurchaseHolds(
        tx,
        purchase.id,
        input.reason ?? `${purchase.purchaseNumber} cancelled`,
      );
    });

    await notifyPurchaseUpdate({
      event: 'cancelled_by_us',
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      buyerPartnerId: purchase.buyerPartnerId,
      buyerName: purchase.buyerName,
      reason: input.reason,
    });

    return { purchaseNumber: purchase.purchaseNumber };
  });

export default adminCancelPurchase;

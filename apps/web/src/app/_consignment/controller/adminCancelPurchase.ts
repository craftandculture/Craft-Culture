import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import releasePurchaseHolds from '../utils/releasePurchaseHolds';

/**
 * Close a purchase that is not going to happen
 *
 * For the money that never arrived, the reservation somebody asked to extend
 * and then did not use, and the order placed by mistake. Refused once ownership
 * has moved: that is a sale, and reversing it means selling the wine back
 * rather than deleting the record of it.
 */
const adminCancelPurchase = adminProcedure
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
      await releasePurchaseHolds(
        tx,
        purchase.id,
        input.reason ?? `${purchase.purchaseNumber} cancelled`,
      );

      await tx
        .update(cellarPurchases)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          notes: input.reason ?? purchase.notes,
          updatedAt: now,
        })
        .where(eq(cellarPurchases.id, purchase.id));
    });

    return { purchaseNumber: purchase.purchaseNumber };
  });

export default adminCancelPurchase;

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import releasePurchaseHolds from '../utils/releasePurchaseHolds';

/**
 * A member changes their mind before paying
 *
 * Allowed right up until the money is confirmed, because until then nothing has
 * happened: no wine has moved, nobody has been paid, and the only thing holding
 * the parcels is our own reservation. Once ownership has moved it is a sale and
 * cancelling it would mean selling it back.
 *
 * Releasing the holds is the point of this. A cancelled order that kept its
 * reservations would leave the wine off the catalogue with nothing on any
 * screen explaining why.
 */
const memberCancelPurchase = stockOwnerProcedure
  .input(
    z.object({
      purchaseId: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [purchase] = await db
      .select()
      .from(cellarPurchases)
      .where(
        and(
          eq(cellarPurchases.id, input.purchaseId),
          eq(cellarPurchases.buyerPartnerId, ctx.partner.id),
        ),
      )
      .limit(1);

    if (!purchase) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
    }

    if (purchase.status === 'completed') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This purchase is complete and the wine is in your cellar. To sell it again, offer it from there.',
      });
    }

    if (['cancelled', 'expired'].includes(purchase.status)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This purchase is already closed.',
      });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await releasePurchaseHolds(
        tx,
        purchase.id,
        `${purchase.purchaseNumber} cancelled by the buyer`,
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

export default memberCancelPurchase;

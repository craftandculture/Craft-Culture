import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * A member says they have sent the money
 *
 * This is a claim and nothing more. It does not move wine, and the screen says
 * so — an admin confirms the transfer has landed and that is what completes the
 * purchase. Recording the claim is still worth doing: it tells us to go and
 * look, and it stops the reservation lapsing under someone who has paid.
 */
const memberMarkPurchasePaid = stockOwnerProcedure
  .input(
    z.object({
      purchaseId: z.string().uuid(),
      paymentReference: z.string().max(200).optional(),
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

    if (!['reserved', 'payment_claimed'].includes(purchase.status)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          purchase.status === 'completed'
            ? 'This purchase is already complete — the wine is in your cellar.'
            : `This purchase is ${purchase.status}.`,
      });
    }

    await db
      .update(cellarPurchases)
      .set({
        status: 'payment_claimed',
        paymentClaimedAt: new Date(),
        paymentReference: input.paymentReference,
        updatedAt: new Date(),
      })
      .where(eq(cellarPurchases.id, purchase.id));

    return { purchaseNumber: purchase.purchaseNumber };
  });

export default memberMarkPurchasePaid;

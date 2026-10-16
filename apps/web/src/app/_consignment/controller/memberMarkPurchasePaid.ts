import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import notifyPurchaseUpdate from '../utils/notifyPurchaseUpdate';

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

    /*
      Only from an open state. Written unconditionally, a claim landing as the
      hourly job expires the purchase reopens it with its holds already gone.
    */
    const [claimed] = await db
      .update(cellarPurchases)
      .set({
        status: 'payment_claimed',
        paymentClaimedAt: new Date(),
        paymentReference: input.paymentReference,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cellarPurchases.id, purchase.id),
          inArray(cellarPurchases.status, ['reserved', 'payment_claimed']),
        ),
      )
      .returning({ id: cellarPurchases.id });

    if (!claimed) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This reservation has just closed. Please refresh, and contact us if you have already sent the payment.',
      });
    }

    /* Told once, on the first claim, not again if they press it twice. */
    if (purchase.status === 'reserved') {
      await notifyPurchaseUpdate({
        event: 'payment_claimed',
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        buyerPartnerId: purchase.buyerPartnerId,
        buyerName: purchase.buyerName,
        totalUsd: purchase.totalUsd,
      });
    }

    return { purchaseNumber: purchase.purchaseNumber };
  });

export default memberMarkPurchasePaid;

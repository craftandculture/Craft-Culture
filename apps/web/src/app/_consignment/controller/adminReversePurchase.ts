import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import getClaimedBottles from '@/app/_cellar/data/getClaimedBottles';
import transferStockOwnership from '@/app/_wms/utils/transferStockOwnership';
import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  saleMandateLots,
  saleMandates,
  wmsStock,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyPurchaseUpdate from '../utils/notifyPurchaseUpdate';

/**
 * Undo a completed cellar purchase and put the wine back where it came from
 *
 * Cancelling refuses a completed purchase on purpose: the wine has changed
 * hands, and deleting the record would leave it in the buyer's cellar with no
 * sale behind it. Reversing is a sale back. Ownership returns to whoever sold
 * it, the wine goes back on the list it was bought from, and the purchase is
 * closed with the reason written on it.
 *
 * Only C&C's own wine can be reversed here. A member's parcel sold on their
 * behalf has a settlement and a payout behind it, and unpicking those is a
 * finance decision, not a button.
 *
 * Refused while anything still claims the bottles in the buyer's cellar — a
 * delivery requested or an offer to sell — so a reversal can never pull wine
 * out from under a request the member is waiting on.
 */
const adminReversePurchase = staffAdminProcedure
  .input(
    z.object({
      purchaseId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [purchase] = await db
      .select()
      .from(cellarPurchases)
      .where(eq(cellarPurchases.id, input.purchaseId))
      .limit(1);

    if (!purchase) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
    }

    if (purchase.status !== 'completed') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'Only a transferred purchase can be reversed. Cancel an open one instead.',
      });
    }

    const items = await db
      .select()
      .from(cellarPurchaseItems)
      .where(eq(cellarPurchaseItems.purchaseId, purchase.id));

    if (items.some((item) => item.mandateId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          "This purchase includes a member's wine sold on their behalf. Its settlement has to be unwound by finance, so it cannot be reversed here.",
      });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(cellarPurchases)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          notes: `Reversed after transfer: ${input.reason}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(cellarPurchases.id, purchase.id),
            eq(cellarPurchases.status, 'completed'),
          ),
        )
        .returning({ id: cellarPurchases.id });

      if (!claimed) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This purchase changed while you were reversing it. Refresh to see where it stands.',
        });
      }

      for (const item of items) {
        const [origin] = await tx
          .select({ locationId: wmsStock.locationId })
          .from(wmsStock)
          .where(eq(wmsStock.id, item.stockId))
          .limit(1);

        if (!origin || !item.sellerPartnerId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `${item.productName}: the original stock line or seller can no longer be found.`,
          });
        }

        /*
          The buyer's row is the original one when the whole line was bought,
          or a row the transfer created beside it when only part was. Either
          way it is this wine, at the same place, now in the buyer's name.
        */
        const [held] = await tx
          .select()
          .from(wmsStock)
          .where(
            and(
              eq(wmsStock.lwin18, item.lwin18),
              eq(wmsStock.locationId, origin.locationId),
              eq(wmsStock.ownerId, purchase.buyerPartnerId),
            ),
          )
          .for('update')
          .limit(1);

        if (!held || held.availableCases < item.cases) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `${item.productName}: the member no longer holds the ${item.cases} ${item.cases === 1 ? 'case' : 'cases'} bought, so it cannot be moved back.`,
          });
        }

        const claims = (await getClaimedBottles([held.id])).get(held.id) ?? 0;

        if (claims > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `${item.productName}: ${claims} bottles are on an open delivery request or offer to sell. Close those first.`,
          });
        }

        /* Offers sent back for a new price still point at this row; they go with it. */
        const drafts = await tx
          .select({ id: saleMandates.id })
          .from(saleMandates)
          .innerJoin(saleMandateLots, eq(saleMandateLots.mandateId, saleMandates.id))
          .where(
            and(
              eq(saleMandateLots.stockId, held.id),
              eq(saleMandates.status, 'draft'),
            ),
          );

        if (drafts.length > 0) {
          await tx
            .update(saleMandates)
            .set({ status: 'withdrawn', updatedAt: now })
            .where(
              inArray(
                saleMandates.id,
                drafts.map((draft) => draft.id),
              ),
            );
        }

        const moved = await transferStockOwnership({
          tx,
          stockId: held.id,
          newOwnerId: item.sellerPartnerId,
          quantityCases: item.cases,
          reasonCode: 'purchase_reversal',
          orderId: purchase.id,
          performedBy: ctx.user.id,
          notes: `${purchase.purchaseNumber} reversed — ${input.reason}`,
        });

        /*
          Back on sale. It was on the list when it was bought — the pool only
          sells wine that is — and the purchase marked it not for sale for the
          buyer. Left that way it would sit in our name, invisible to every
          price list.
        */
        await tx
          .update(wmsStock)
          .set({ notForSale: false, updatedAt: now })
          .where(eq(wmsStock.id, moved.destinationStockId));
      }
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

export default adminReversePurchase;

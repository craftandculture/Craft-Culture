import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  saleMandateLots,
  saleMandates,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getCommittedBottles from '../data/getCommittedBottles';
import { WITHDRAWABLE_STATUSES } from '../utils/mandateStatuses';

/**
 * A member takes their wine back off the market
 *
 * Allowed while the wine is still in bond with us — offered, or listed on the
 * price lists. Once it has been placed with a distributor it is duty-paid and
 * out of the building, and there is nothing to withdraw it from.
 *
 * Each parcel goes back to the hold state it had *before* it was offered,
 * rather than to "not for sale" outright. Those are usually the same thing, but
 * not always: a wine partner's stock may have been sellable already, and
 * forcing it onto hold would quietly remove it from the price lists it was on
 * before any of this happened.
 */
const memberWithdrawMandate = stockOwnerProcedure
  .input(z.object({ mandateId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [mandate] = await db
      .select()
      .from(saleMandates)
      .where(
        and(
          eq(saleMandates.id, input.mandateId),
          eq(saleMandates.ownerId, ctx.partner.id),
        ),
      )
      .limit(1);

    if (!mandate) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Offer not found' });
    }

    if (
      !WITHDRAWABLE_STATUSES.includes(
        mandate.status as (typeof WITHDRAWABLE_STATUSES)[number],
      )
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          mandate.status === 'placed' || mandate.status === 'partially_sold'
            ? 'This wine has been placed with a distributor and can no longer be withdrawn. Contact us and we will tell you where it stands.'
            : 'This offer is no longer open.',
      });
    }

    const lots = await db
      .select()
      .from(saleMandateLots)
      .where(eq(saleMandateLots.mandateId, mandate.id));

    /*
      Parcels another live mandate still covers. A parcel can appear in more
      than one offer — a member may offer six bottles, then six more of the same
      case — and restoring the hold here would quietly pull the *other* offer's
      wine off the price list it is legitimately on. Whoever withdraws last
      restores it.
    */
    const stillClaimed = await getCommittedBottles(
      lots.map((lot) => lot.stockId),
      mandate.id,
    );

    await db.transaction(async (tx) => {
      /*
        Not while a buyer holds bottles from this offer. Their purchase is
        reserved against it and may already be paid; withdrawing under it
        would let staff confirm the payment and sell wine the member had taken
        off the market. They wait for it to complete, lapse or be cancelled.
      */
      const [openPurchase] = await tx
        .select({ purchaseNumber: cellarPurchases.purchaseNumber })
        .from(cellarPurchaseItems)
        .innerJoin(
          cellarPurchases,
          eq(cellarPurchases.id, cellarPurchaseItems.purchaseId),
        )
        .where(
          and(
            eq(cellarPurchaseItems.mandateId, mandate.id),
            inArray(cellarPurchases.status, ['reserved', 'payment_claimed']),
          ),
        )
        .limit(1);

      if (openPurchase) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'A buyer is holding bottles from this offer while their payment is completed, so it cannot be withdrawn just now. Please try again once the purchase has settled or lapsed, or contact us.',
        });
      }

      /*
        The status first, and only from the status read above. A sale or a
        staff decision landing in the same moment would otherwise be
        overwritten by "withdrawn" — with the wine sold and the hold restored.
      */
      const [withdrawn] = await tx
        .update(saleMandates)
        .set({
          status: 'withdrawn',
          withdrawnAt: new Date(),
          withdrawnBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(saleMandates.id, mandate.id),
            eq(saleMandates.status, mandate.status),
          ),
        )
        .returning({ id: saleMandates.id });

      if (!withdrawn) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This offer has just changed. Refresh the page to see where it stands.',
        });
      }

      /*
        Grouped so one statement restores every parcel that was held, and
        another every parcel that was already sellable — rather than a query per
        lot, and rather than assuming they were all the same.
      */
      const restorable = lots.filter(
        (lot) => (stillClaimed.get(lot.stockId) ?? 0) === 0,
      );

      const toHold = restorable
        .filter((lot) => lot.previousNotForSale)
        .map((lot) => lot.stockId);

      const toRelease = restorable
        .filter((lot) => !lot.previousNotForSale)
        .map((lot) => lot.stockId);

      if (toHold.length > 0) {
        await tx
          .update(wmsStock)
          .set({ notForSale: true, updatedAt: new Date() })
          .where(
            and(
              inArray(wmsStock.id, toHold),
              /*
                Only the member's own rows. If a parcel changed hands while the
                offer was open, putting it on hold would be reaching into
                somebody else's stock.
              */
              eq(wmsStock.ownerId, ctx.partner.id),
            ),
          );
      }

      if (toRelease.length > 0) {
        await tx
          .update(wmsStock)
          .set({ notForSale: false, updatedAt: new Date() })
          .where(
            and(
              inArray(wmsStock.id, toRelease),
              eq(wmsStock.ownerId, ctx.partner.id),
            ),
          );
      }

    });

    return { mandateNumber: mandate.mandateNumber };
  });

export default memberWithdrawMandate;

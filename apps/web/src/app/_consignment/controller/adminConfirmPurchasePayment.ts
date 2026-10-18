import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import getPricingManagerLanded from '@/app/_distribution/data/getPricingManagerLanded';
import wineKey from '@/app/_distribution/utils/wineKey';
import transferStockOwnership from '@/app/_wms/utils/transferStockOwnership';
import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  wmsStockReservations,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import describeLineSellers from '../data/describeLineSellers';
import notifyPurchaseUpdate from '../utils/notifyPurchaseUpdate';
import recordPoolSale from '../utils/recordPoolSale';
import writePartnerSettlement from '../utils/writePartnerSettlement';

/**
 * Confirm the money landed, and move the wine
 *
 * A member marking a transfer as sent is a claim, not a receipt. This is the
 * only thing that moves ownership, and it exists as a separate admin action so
 * C&C never hands over wine on somebody's say-so — the same rule that governs
 * paying consignors, applied to the other side of the trade.
 *
 * Everything happens in one transaction: the reservation is released, ownership
 * moves, and where the parcel belonged to a member their sale and settlement
 * are written. A partial failure here would leave wine transferred with nobody
 * owed for it, or owed for without the wine moving.
 *
 * The buyer is a cellar member, so the commission rate is the collector rate.
 */
const adminConfirmPurchasePayment = staffAdminProcedure
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
      .where(eq(cellarPurchases.id, input.purchaseId))
      .limit(1);

    if (!purchase) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
    }

    if (purchase.status === 'expired') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This purchase expired and its wine went back on the list. Ask the member to order again, so the wine is reserved before it is transferred.',
      });
    }

    if (!['reserved', 'payment_claimed'].includes(purchase.status)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This purchase is already ${purchase.status}.`,
      });
    }

    const items = await db
      .select()
      .from(cellarPurchaseItems)
      .where(eq(cellarPurchaseItems.purchaseId, purchase.id));

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This purchase has no lines.',
      });
    }

    /*
      Who each line settles to, read before ownership moves: once the wine is
      the buyer's, the row no longer says whose it was.
    */
    const sellers = await describeLineSellers(items);

    const partnerKeys = items
      .filter((item) => sellers.get(item.id)?.kind === 'partner')
      .map((item) => wineKey(item.lwin18));

    const landedByKey = new Map(
      (await getPricingManagerLanded([...new Set(partnerKeys)])).map((row) => [
        row.key,
        row.landedPerBottle,
      ]),
    );

    const now = new Date();

    await db.transaction(async (tx) => {
      /*
        Claimed first, and only from an open state. A double click, or a cancel
        or expiry landing at the same moment, finds no row to claim and stops
        here — otherwise the wine moves twice and the member is settled twice.
      */
      const [claimed] = await tx
        .update(cellarPurchases)
        .set({
          status: 'completed',
          paymentConfirmedAt: now,
          paymentConfirmedBy: ctx.user.id,
          paymentReference: input.paymentReference ?? purchase.paymentReference,
          completedAt: now,
          updatedAt: now,
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
            'This purchase changed while you were confirming it. Refresh to see where it stands.',
        });
      }

      for (const item of items) {
        /*
          Released first, not overridden. transferStockOwnership refuses to move
          reserved stock, and allowing it to would leave our own reservation
          pointing at a row its order no longer owns.
        */
        if (item.reservationId) {
          await tx
            .update(wmsStockReservations)
            .set({
              status: 'released',
              releasedAt: now,
              releaseReason: `Sold on ${purchase.purchaseNumber}`,
            })
            .where(eq(wmsStockReservations.id, item.reservationId));
        }

        await transferStockOwnership({
          tx,
          stockId: item.stockId,
          newOwnerId: purchase.buyerPartnerId,
          quantityCases: item.cases,
          reasonCode: 'pool_sale',
          orderId: purchase.id,
          performedBy: ctx.user.id,
          notes: `${purchase.purchaseNumber} — in-bond purchase`,
        });

        /*
          A member's parcel settles at their ask, a partner's consignment at
          its landed cost. C&C's own stock owes nobody, and writing a
          settlement for it would put a debt to ourselves on the payout run.
        */
        const seller = sellers.get(item.id);

        if (seller?.kind === 'partner' && seller.ownerId) {
          await writePartnerSettlement({
            tx,
            purchase,
            line: item,
            ownerId: seller.ownerId,
            ownerName: seller.label,
            landedPerBottle: landedByKey.get(wineKey(item.lwin18)) ?? null,
          });
        }

        if (item.mandateId) {
          await recordPoolSale({
            tx,
            mandateId: item.mandateId,
            mandateLotId: item.mandateLotId,
            stockId: item.stockId,
            bottles: item.bottles,
            salePricePerBottleUsd: item.pricePerBottleUsd,
            buyerAudience: 'collector',
            buyerPartnerId: purchase.buyerPartnerId,
            buyerName: purchase.buyerName,
            source: 'in_app',
            paid: true,
            recordedBy: ctx.user.id,
            notes: purchase.purchaseNumber,
          });
        }
      }
    });

    await notifyPurchaseUpdate({
      event: 'completed',
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      buyerPartnerId: purchase.buyerPartnerId,
      buyerName: purchase.buyerName,
    });

    return {
      purchaseNumber: purchase.purchaseNumber,
      lines: items.length,
      buyerName: purchase.buyerName,
    };
  });

export default adminConfirmPurchasePayment;

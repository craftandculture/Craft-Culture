import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import transferStockOwnership from '@/app/_wms/utils/transferStockOwnership';
import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  wmsStockReservations,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recordPoolSale from '../utils/recordPoolSale';

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
const adminConfirmPurchasePayment = adminProcedure
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

    if (['completed', 'cancelled'].includes(purchase.status)) {
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

    const now = new Date();

    await db.transaction(async (tx) => {
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
          Only a member's parcel settles. C&C's own stock sold from the pool
          owes nobody, and writing a settlement for it would put a debt to
          ourselves on the payout run.
        */
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

      await tx
        .update(cellarPurchases)
        .set({
          status: 'completed',
          paymentConfirmedAt: now,
          paymentConfirmedBy: ctx.user.id,
          paymentReference: input.paymentReference ?? purchase.paymentReference,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(cellarPurchases.id, purchase.id));
    });

    return {
      purchaseNumber: purchase.purchaseNumber,
      lines: items.length,
      buyerName: purchase.buyerName,
    };
  });

export default adminConfirmPurchasePayment;

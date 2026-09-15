import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  wmsStockReservations,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import { reservedUntilFrom } from '../constants/purchaseTerms';
import allocateParcels from '../data/allocateParcels';
import getCatalogueRowFor from '../data/getCatalogueRowFor';
import generatePurchaseNumber from '../utils/generatePurchaseNumber';

/**
 * A member buys wine that stays in bond
 *
 * Nothing physically moves and no duty is triggered; what changes is who holds
 * the beneficial interest. Ownership does not move here either — this reserves
 * the parcels and starts the clock. The wine becomes theirs when the money is
 * confirmed, because C&C does not front money on anybody's behalf.
 *
 * Prices are re-read from the catalogue rather than trusted from the browser,
 * which is the difference between a price list and a price the customer types.
 *
 * Whole cases only. The transfer primitive works in cases, and a part case
 * bought in bond would have to be expressed as a fraction of a stock row.
 */
const memberCreatePurchase = stockOwnerProcedure
  .input(
    z.object({
      lines: z
        .array(
          z.object({
            lwin18: z.string().min(1).max(40),
            cases: z.number().int().min(1).max(500),
          }),
        )
        .min(1, 'Choose at least one wine')
        .max(50),
      notes: z.string().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const purchaseNumber = await generatePurchaseNumber();

    const prepared: {
      allocation: Awaited<ReturnType<typeof allocateParcels>>;
      pricePerBottleUsd: number;
    }[] = [];

    for (const line of input.lines) {
      const row = await getCatalogueRowFor(line.lwin18);

      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'That wine is no longer available.',
        });
      }

      const allocation = await allocateParcels(
        line.lwin18,
        line.cases,
        ctx.partner.id,
      );

      const allocated = allocation.reduce((sum, parcel) => sum + parcel.cases, 0);

      if (allocated < line.cases) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            allocated === 0
              ? `${row.product} is no longer available.`
              : `Only ${allocated} ${allocated === 1 ? 'case' : 'cases'} of ${row.product} ${allocated === 1 ? 'is' : 'are'} available.`,
        });
      }

      prepared.push({ allocation, pricePerBottleUsd: row.ibPerBottle });
    }

    const result = await db.transaction(async (tx) => {
      const [purchase] = await tx
        .insert(cellarPurchases)
        .values({
          purchaseNumber,
          buyerPartnerId: ctx.partner.id,
          buyerName: ctx.partner.businessName,
          status: 'reserved',
          reservedUntil: reservedUntilFrom(now),
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning({ id: cellarPurchases.id });

      if (!purchase) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not start that purchase',
        });
      }

      let subtotal = 0;

      for (const { allocation, pricePerBottleUsd } of prepared) {
        for (const parcel of allocation) {
          const bottles = parcel.cases * parcel.caseConfig;
          const lineTotal = Math.round(pricePerBottleUsd * bottles * 100) / 100;

          subtotal += lineTotal;

          const [item] = await tx
            .insert(cellarPurchaseItems)
            .values({
              purchaseId: purchase.id,
              stockId: parcel.stockId,
              mandateId: parcel.mandateId,
              mandateLotId: parcel.mandateLotId,
              sellerPartnerId: parcel.sellerPartnerId,
              lwin18: parcel.lwin18,
              productName: parcel.productName,
              producer: parcel.producer,
              vintage: parcel.vintage,
              bottleSize: parcel.bottleSize,
              caseConfig: parcel.caseConfig,
              cases: parcel.cases,
              bottles,
              pricePerBottleUsd,
              lineTotalUsd: lineTotal,
            })
            .returning({ id: cellarPurchaseItems.id });

          if (!item) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Could not reserve that parcel',
            });
          }

          /*
            The hold. Without it two members buy the same case and one of them
            gets an apology — and transferStockOwnership refuses to move
            reserved stock, so this is also what protects the parcel from every
            other consumption path in the warehouse.
          */
          const [reservation] = await tx
            .insert(wmsStockReservations)
            .values({
              stockId: parcel.stockId,
              ownerId: parcel.sellerPartnerId,
              orderType: 'cellar_purchase',
              orderId: purchase.id,
              orderNumber: purchaseNumber,
              orderItemId: item.id,
              lwin18: parcel.lwin18,
              productName: parcel.productName,
              quantityCases: parcel.cases,
              status: 'active',
            })
            .returning({ id: wmsStockReservations.id });

          await tx
            .update(cellarPurchaseItems)
            .set({ reservationId: reservation?.id })
            .where(eq(cellarPurchaseItems.id, item.id));
        }
      }

      const total = Math.round(subtotal * 100) / 100;

      await tx
        .update(cellarPurchases)
        .set({ subtotalUsd: total, totalUsd: total, updatedAt: new Date() })
        .where(eq(cellarPurchases.id, purchase.id));

      return { id: purchase.id, total };
    });

    return {
      purchaseId: result.id,
      purchaseNumber,
      totalUsd: result.total,
      reservedUntil: reservedUntilFrom(now),
    };
  });

export default memberCreatePurchase;

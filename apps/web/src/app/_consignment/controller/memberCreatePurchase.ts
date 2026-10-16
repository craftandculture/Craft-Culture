import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
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
 * Open purchases a member may hold at once
 *
 * Each one takes wine off the list for everybody else, and one marked paid is
 * never lapsed automatically, so an unlimited number would let one member
 * freeze the catalogue.
 */
const MAX_OPEN_PURCHASES = 5;

/** A clash on the purchase number, which is max-plus-one and so racy */
const isPurchaseNumberClash = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505' &&
  String((error as { constraint?: string }).constraint ?? '').includes(
    'purchase_number',
  );

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
    await assertActivated(ctx.partner.id);

    const now = new Date();

    const [open] = await db
      .select({ value: count() })
      .from(cellarPurchases)
      .where(
        and(
          eq(cellarPurchases.buyerPartnerId, ctx.partner.id),
          inArray(cellarPurchases.status, ['reserved', 'payment_claimed']),
        ),
      );

    if ((open?.value ?? 0) >= MAX_OPEN_PURCHASES) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'You have several purchases waiting to be settled. Please complete or cancel one of those first, or contact us and we will help.',
      });
    }

    /*
      Prices first, outside the transaction: the catalogue read is heavy and
      the price does not need the rows locked.
    */
    const priced: {
      lwin18: string;
      cases: number;
      product: string;
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

      priced.push({
        lwin18: line.lwin18,
        cases: line.cases,
        product: row.product,
        pricePerBottleUsd: row.ibPerBottle,
      });
    }

    const placeOrder = async (purchaseNumber: string) =>
      db.transaction(async (tx) => {
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

        /*
          One line at a time: allocate with the stock rows locked, then write
          that line's holds before allocating the next. A second buyer waits on
          the lock and then sees these cases as taken, and two lines of the same
          wine in one order cannot both claim the same case.
        */
        for (const line of priced) {
          const allocation = await allocateParcels(
            line.lwin18,
            line.cases,
            ctx.partner.id,
            tx,
          );

          const allocated = allocation.reduce(
            (sum, parcel) => sum + parcel.cases,
            0,
          );

          if (allocated < line.cases) {
            throw new TRPCError({
              code: 'CONFLICT',
              message:
                allocated === 0
                  ? `${line.product} is no longer available.`
                  : `Only ${allocated} ${allocated === 1 ? 'case' : 'cases'} of ${line.product} ${allocated === 1 ? 'is' : 'are'} available.`,
            });
          }

          for (const parcel of allocation) {
            const bottles = parcel.cases * parcel.caseConfig;
            const lineTotal =
              Math.round(line.pricePerBottleUsd * bottles * 100) / 100;

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
                pricePerBottleUsd: line.pricePerBottleUsd,
                lineTotalUsd: lineTotal,
              })
              .returning({ id: cellarPurchaseItems.id });

            if (!item) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Could not reserve that wine',
              });
            }

            /*
              The hold. allocateParcels subtracts every active cellar hold, so
              this row is what stops the next buyer taking the same case — and
              transferStockOwnership refuses to move reserved stock, so it also
              protects the parcel from every other path in the warehouse.
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

    let purchaseNumber = await generatePurchaseNumber();
    let result: Awaited<ReturnType<typeof placeOrder>> | undefined;

    for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
      try {
        result = await placeOrder(purchaseNumber);
      } catch (error) {
        if (!isPurchaseNumberClash(error) || attempt === 2) throw error;

        purchaseNumber = await generatePurchaseNumber();
      }
    }

    if (!result) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not start that purchase',
      });
    }

    return {
      purchaseId: result.id,
      purchaseNumber,
      totalUsd: result.total,
      reservedUntil: reservedUntilFrom(now),
    };
  });

export default memberCreatePurchase;

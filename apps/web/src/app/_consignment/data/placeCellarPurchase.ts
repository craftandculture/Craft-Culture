import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarPurchaseItems,
  cellarPurchases,
  wmsStockReservations,
} from '@/database/schema';

import allocateParcels from './allocateParcels';
import { reservedUntilFrom } from '../constants/purchaseTerms';
import generatePurchaseNumber from '../utils/generatePurchaseNumber';
import notifyPurchaseUpdate from '../utils/notifyPurchaseUpdate';

/** A clash on the purchase number, which is max-plus-one and so racy */
const isPurchaseNumberClash = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505' &&
  String((error as { constraint?: string }).constraint ?? '').includes(
    'purchase_number',
  );

export interface PlaceCellarPurchaseParams {
  partnerId: string;
  partnerName: string;
  userId: string;
  /** Lines already priced: from the catalogue, or a price we agreed */
  priced: {
    lwin18: string;
    cases: number;
    product: string;
    pricePerBottleUsd: number;
  }[];
  notes?: string;
}

/**
 * Reserve wine from the C&C pool for a member, at the prices given
 *
 * Shared by buying from Available now (catalogue prices) and by accepting a
 * wine we found or allocated (the price we offered). Allocation, holds and
 * numbering are the same either way, so they live in one place.
 *
 * @param params - The buyer and the priced lines
 * @returns The purchase id, number, total and how long it is held
 */
const placeCellarPurchase = async ({
  partnerId,
  partnerName,
  userId,
  priced,
  notes,
}: PlaceCellarPurchaseParams) => {
  const now = new Date();

  const placeOrder = async (purchaseNumber: string) =>
    db.transaction(async (tx) => {
      const [purchase] = await tx
        .insert(cellarPurchases)
        .values({
          purchaseNumber,
          buyerPartnerId: partnerId,
          buyerName: partnerName,
          status: 'reserved',
          reservedUntil: reservedUntilFrom(now),
          notes: notes,
          createdBy: userId,
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
          partnerId,
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

  await notifyPurchaseUpdate({
    event: 'reserved',
    purchaseId: result.id,
    purchaseNumber,
    buyerPartnerId: partnerId,
    buyerName: partnerName,
    totalUsd: result.total,
  });

  return {
    purchaseId: result.id,
    purchaseNumber,
    totalUsd: result.total,
    reservedUntil: reservedUntilFrom(now),
  };
};

export default placeCellarPurchase;

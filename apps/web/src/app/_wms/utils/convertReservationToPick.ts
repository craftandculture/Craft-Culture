import { and, eq, sql } from 'drizzle-orm';

import { wmsStock, wmsStockReservations } from '@/database/schema';

interface ConvertParams {
  stockId: string;
  orderId: string;
  quantityCases: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Convert stock reservations to picks and decrement stock
 *
 * If active reservations exist for this stock+order, decrements
 * reservedCases and quantityCases (availableCases unchanged since
 * it was already decremented at reservation time).
 *
 * For any unreserved portion, falls back to decrementing
 * quantityCases and availableCases (current behavior).
 *
 * Backward compatible — orders without reservations work as before.
 *
 * @example
 *   await convertReservationToPick({
 *     stockId: 'uuid',
 *     orderId: 'uuid',
 *     quantityCases: 5,
 *     db,
 *   });
 */
const convertReservationToPick = async ({
  stockId,
  orderId,
  quantityCases,
  db,
}: ConvertParams) => {
  const now = new Date();
  let remainingToPick = quantityCases;
  let reservedPicked = 0;

  // Find active reservations for this stock + order
  const reservations = await db
    .select({
      id: wmsStockReservations.id,
      quantityCases: wmsStockReservations.quantityCases,
    })
    .from(wmsStockReservations)
    .where(
      and(
        eq(wmsStockReservations.stockId, stockId),
        eq(wmsStockReservations.orderId, orderId),
        eq(wmsStockReservations.status, 'active'),
      ),
    );

  // Convert reservations to picks
  for (const reservation of reservations) {
    if (remainingToPick <= 0) break;

    const pickFromReservation = Math.min(
      remainingToPick,
      reservation.quantityCases,
    );

    // Decrement quantityCases and reservedCases (availableCases stays same)
    await db
      .update(wmsStock)
      .set({
        quantityCases: sql`${wmsStock.quantityCases} - ${pickFromReservation}`,
        reservedCases: sql`${wmsStock.reservedCases} - ${pickFromReservation}`,
        updatedAt: now,
      })
      .where(eq(wmsStock.id, stockId));

    // Mark reservation as picked
    if (pickFromReservation >= reservation.quantityCases) {
      // Fully consumed
      await db
        .update(wmsStockReservations)
        .set({
          status: 'picked' as const,
          pickedAt: now,
          updatedAt: now,
        })
        .where(eq(wmsStockReservations.id, reservation.id));
    } else {
      // Partially consumed — reduce reservation quantity and keep active
      await db
        .update(wmsStockReservations)
        .set({
          quantityCases: sql`${wmsStockReservations.quantityCases} - ${pickFromReservation}`,
          updatedAt: now,
        })
        .where(eq(wmsStockReservations.id, reservation.id));
    }

    remainingToPick -= pickFromReservation;
    reservedPicked += pickFromReservation;
  }

  // Unreserved portion — decrement quantityCases and availableCases
  // Cap at availableCases to prevent stock going negative
  let unreservedPicked = 0;

  if (remainingToPick > 0) {
    const [currentStock] = await db
      .select({ availableCases: wmsStock.availableCases })
      .from(wmsStock)
      .where(eq(wmsStock.id, stockId));

    unreservedPicked = Math.min(
      remainingToPick,
      currentStock?.availableCases ?? 0,
    );

    if (unreservedPicked > 0) {
      await db
        .update(wmsStock)
        .set({
          quantityCases: sql`${wmsStock.quantityCases} - ${unreservedPicked}`,
          availableCases: sql`${wmsStock.availableCases} - ${unreservedPicked}`,
          updatedAt: now,
        })
        .where(eq(wmsStock.id, stockId));
    }
  }

  return {
    reservedPicked,
    unreservedPicked,
    totalPicked: reservedPicked + unreservedPicked,
  };
};

export default convertReservationToPick;

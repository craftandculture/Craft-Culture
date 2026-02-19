import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock, wmsStockReservations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getOrderReservationsSchema from '../schemas/reservationSchema';

/**
 * Get all stock reservations for an order
 *
 * Returns reservation records joined with stock and location details.
 *
 * @example
 *   await trpcClient.wms.admin.ownership.getReservations.query({
 *     orderId: "uuid",
 *     orderType: "zoho",
 *   });
 */
const adminGetOrderReservations = adminProcedure
  .input(getOrderReservationsSchema)
  .query(async ({ input }) => {
    const { orderId, orderType } = input;

    const reservations = await db
      .select({
        id: wmsStockReservations.id,
        stockId: wmsStockReservations.stockId,
        orderItemId: wmsStockReservations.orderItemId,
        orderNumber: wmsStockReservations.orderNumber,
        lwin18: wmsStockReservations.lwin18,
        productName: wmsStockReservations.productName,
        quantityCases: wmsStockReservations.quantityCases,
        status: wmsStockReservations.status,
        createdAt: wmsStockReservations.createdAt,
        pickedAt: wmsStockReservations.pickedAt,
        releasedAt: wmsStockReservations.releasedAt,
        releaseReason: wmsStockReservations.releaseReason,
        locationCode: wmsLocations.locationCode,
        locationType: wmsLocations.locationType,
        stockQuantity: wmsStock.quantityCases,
        stockAvailable: wmsStock.availableCases,
        stockReserved: wmsStock.reservedCases,
      })
      .from(wmsStockReservations)
      .innerJoin(wmsStock, eq(wmsStockReservations.stockId, wmsStock.id))
      .leftJoin(wmsLocations, eq(wmsStock.locationId, wmsLocations.id))
      .where(
        and(
          eq(wmsStockReservations.orderId, orderId),
          eq(wmsStockReservations.orderType, orderType),
        ),
      );

    return reservations;
  });

export default adminGetOrderReservations;

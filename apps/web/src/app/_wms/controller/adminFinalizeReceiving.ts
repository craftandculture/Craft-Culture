import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments, wmsReceivingDrafts, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Finalize receiving for a shipment
 *
 * Sets the shipment status to 'delivered' and cleans up the receiving draft.
 * All stock and movement records should already exist from incremental
 * per-product commits via receiveShipmentItem.
 *
 * @example
 *   await trpcClient.wms.admin.receiving.finalizeReceiving.mutate({
 *     shipmentId: 'uuid',
 *   });
 */
const adminFinalizeReceiving = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { shipmentId } = input;

    // Verify shipment exists
    const [shipment] = await db
      .select({ id: logisticsShipments.id, status: logisticsShipments.status })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId));

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    // Set shipment to delivered
    await db
      .update(logisticsShipments)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipments.id, shipmentId));

    // Backfill photos from draft items to stock records before deleting
    const [draft] = await db
      .select()
      .from(wmsReceivingDrafts)
      .where(eq(wmsReceivingDrafts.shipmentId, shipmentId));

    if (draft?.items) {
      for (const item of draft.items) {
        if (item.photos && item.photos.length > 0) {
          // Find stock records for this shipment matching by product name
          const stockRecords = await db
            .select({ id: wmsStock.id, photos: wmsStock.photos })
            .from(wmsStock)
            .where(
              and(
                eq(wmsStock.shipmentId, shipmentId),
                eq(wmsStock.productName, item.productName),
              ),
            );

          for (const stock of stockRecords) {
            // Only backfill if stock has no photos yet
            if (!stock.photos || stock.photos.length === 0) {
              await db
                .update(wmsStock)
                .set({ photos: item.photos })
                .where(eq(wmsStock.id, stock.id));
            }
          }

          logger.info('[FinalizeReceiving] Backfilled photos', {
            productName: item.productName,
            photoCount: item.photos.length,
            stockCount: stockRecords.length,
          });
        }
      }
    }

    // Clean up the receiving draft
    await db
      .delete(wmsReceivingDrafts)
      .where(eq(wmsReceivingDrafts.shipmentId, shipmentId));

    return { success: true };
  });

export default adminFinalizeReceiving;

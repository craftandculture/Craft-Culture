import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments, wmsReceivingDrafts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

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

    // Clean up the receiving draft
    await db
      .delete(wmsReceivingDrafts)
      .where(eq(wmsReceivingDrafts.shipmentId, shipmentId));

    return { success: true };
  });

export default adminFinalizeReceiving;

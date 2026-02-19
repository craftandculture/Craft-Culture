import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const deleteShipmentSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Delete a logistics shipment and all related records
 *
 * FK cascades handle child table cleanup:
 * - logisticsShipmentItems (CASCADE)
 * - logisticsDocuments (CASCADE)
 * - logisticsShipmentActivityLogs (CASCADE)
 * - logisticsInvoiceShipments (CASCADE)
 *
 * @example
 *   await trpcClient.logistics.admin.delete.mutate({
 *     id: "shipment-uuid",
 *   });
 */
const adminDeleteShipment = adminProcedure
  .input(deleteShipmentSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;
    const { user } = ctx;

    const [existing] = await db
      .select({ id: logisticsShipments.id, shipmentNumber: logisticsShipments.shipmentNumber })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, id));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    await db.delete(logisticsShipments).where(eq(logisticsShipments.id, id));

    logger.info('Logistics shipment deleted', {
      shipmentId: id,
      shipmentNumber: existing.shipmentNumber,
      deletedBy: user.id,
    });

    return { success: true };
  });

export default adminDeleteShipment;

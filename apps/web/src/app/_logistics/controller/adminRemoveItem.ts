import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const removeItemSchema = z.object({
  itemId: z.string().uuid(),
});

/**
 * Remove an item from a logistics shipment
 *
 * Deletes the item and updates the shipment totals.
 */
const adminRemoveItem = adminProcedure.input(removeItemSchema).mutation(async ({ input }) => {
  const { itemId } = input;

  // Get the item first
  const item = await db.query.logisticsShipmentItems.findFirst({
    where: { id: itemId },
  });

  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Item not found',
    });
  }

  // Delete the item
  await db.delete(logisticsShipmentItems).where(eq(logisticsShipmentItems.id, itemId));

  // Update shipment totals (subtract)
  await db
    .update(logisticsShipments)
    .set({
      totalCases: sql`GREATEST(0, COALESCE(${logisticsShipments.totalCases}, 0) - ${item.cases})`,
      totalBottles: sql`GREATEST(0, COALESCE(${logisticsShipments.totalBottles}, 0) - ${item.totalBottles ?? 0})`,
      totalWeightKg: item.grossWeightKg
        ? sql`GREATEST(0, COALESCE(${logisticsShipments.totalWeightKg}, 0) - ${item.grossWeightKg})`
        : logisticsShipments.totalWeightKg,
      updatedAt: new Date(),
    })
    .where(eq(logisticsShipments.id, item.shipmentId));

  return { success: true };
});

export default adminRemoveItem;

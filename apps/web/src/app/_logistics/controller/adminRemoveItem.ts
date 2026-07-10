import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recalcShipmentTotals from '../utils/recalcShipmentTotals';

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

  // Recompute shipment totals from the remaining line items (drift-proof)
  await recalcShipmentTotals(item.shipmentId);

  return { success: true };
});

export default adminRemoveItem;

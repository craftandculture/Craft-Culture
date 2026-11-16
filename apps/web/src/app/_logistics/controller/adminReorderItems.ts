import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Save the order a shipment's lines are listed in
 *
 * Document order is the order everyone reads the shipment in — the table,
 * the receiving screen, the exports — so moving a wine's 6-pack up beside its
 * 3-pack is saved for all of them, not kept in one browser.
 *
 * The full list is required: a partial one would leave the lines it omits
 * sharing numbers with the ones it moved.
 *
 * @param shipmentId - The shipment
 * @param itemIds - Every line of the shipment, in the new order
 * @returns How many lines were renumbered
 */
const adminReorderItems = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, itemIds } = input;

    const lines = await db
      .select({ id: logisticsShipmentItems.id })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    const onShipment = new Set(lines.map((line) => line.id));
    const given = new Set(itemIds);

    if (
      given.size !== itemIds.length ||
      given.size !== onShipment.size ||
      itemIds.some((id) => !onShipment.has(id))
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'The lines on this shipment have changed. Refresh and move it again.',
      });
    }

    await db.transaction(async (tx) => {
      for (const [index, id] of itemIds.entries()) {
        await tx
          .update(logisticsShipmentItems)
          .set({ sortOrder: index + 1 })
          .where(eq(logisticsShipmentItems.id, id));
      }
    });

    return { reordered: itemIds.length };
  });

export default adminReorderItems;

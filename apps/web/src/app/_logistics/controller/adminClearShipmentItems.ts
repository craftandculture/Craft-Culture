import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recalcShipmentTotals from '../utils/recalcShipmentTotals';

/**
 * Statuses where the items have already been acted on elsewhere.
 *
 * Once a shipment has cleared customs the lines are what was declared, and
 * once it reaches the warehouse they are what was received. Emptying the list
 * then would leave a stock movement with nothing behind it.
 */
const PROTECTED = ['customs', 'cleared', 'warehouse'];

/**
 * Empty a shipment's item list in one go
 *
 * A mis-imported invoice is a whole document's worth of wrong lines, and the
 * only way to undo one was the trash icon on each row — 163 of them on this
 * shipment, which is the same problem the import itself had.
 *
 * The expected count has to be sent and has to match. It is not a
 * confirmation dialog in disguise: it stops a stale screen from emptying a
 * list that someone else has since worked on, which is the one way this can
 * destroy work rather than discard it.
 */
const adminClearShipmentItems = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** How many rows the caller believes are there */
      expectedCount: z.number().int().min(0),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, expectedCount } = input;

    const [shipment] = await db
      .select({
        id: logisticsShipments.id,
        status: logisticsShipments.status,
      })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    if (PROTECTED.includes(shipment.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          `This shipment has reached ${shipment.status}, so its lines are what ` +
          `was declared and received. Correct them individually rather than ` +
          `emptying the list.`,
      });
    }

    const existing = await db
      .select({ id: logisticsShipmentItems.id })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    if (existing.length !== expectedCount) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          `This shipment now has ${existing.length} items, not the ` +
          `${expectedCount} on your screen. Refresh and look again before clearing it.`,
      });
    }

    await db
      .delete(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    await recalcShipmentTotals(shipmentId);

    return { removed: existing.length };
  });

export default adminClearShipmentItems;

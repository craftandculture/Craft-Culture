import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import syncShipmentCostsFromLedger from '../utils/syncShipmentCostsFromLedger';

/**
 * Delete a shipment cost-ledger line, then re-sync the shipment's cost fields.
 */
const adminDeleteShipmentCostLine = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const [line] = await db
      .select({ shipmentId: logisticsShipmentCostLines.shipmentId })
      .from(logisticsShipmentCostLines)
      .where(eq(logisticsShipmentCostLines.id, input.id));

    await db.delete(logisticsShipmentCostLines).where(eq(logisticsShipmentCostLines.id, input.id));

    if (line) await syncShipmentCostsFromLedger(line.shipmentId);
    return { id: input.id };
  });

export default adminDeleteShipmentCostLine;

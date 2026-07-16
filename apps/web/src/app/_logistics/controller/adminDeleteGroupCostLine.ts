import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsGroupCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { deleteGroupCostLineSchema } from '../schemas/shipmentGroupSchemas';
import recalcGroupLandedCost from '../utils/recalcGroupLandedCost';

/**
 * Delete a group cost line (e.g. a refundable document deposit). The group's
 * landed cost is re-allocated afterwards so removing a cost lowers pricing live.
 */
const adminDeleteGroupCostLine = adminProcedure
  .input(deleteGroupCostLineSchema)
  .mutation(async ({ input }) => {
    // Capture the group before deleting so we can re-allocate afterwards.
    const [existing] = await db
      .select({ groupId: logisticsGroupCostLines.groupId })
      .from(logisticsGroupCostLines)
      .where(eq(logisticsGroupCostLines.id, input.id));

    await db.delete(logisticsGroupCostLines).where(eq(logisticsGroupCostLines.id, input.id));

    if (existing) {
      try {
        await recalcGroupLandedCost(existing.groupId);
      } catch (error) {
        console.error('Failed to re-allocate landed cost after deleting cost line', {
          error,
          groupId: existing.groupId,
        });
      }
    }

    return { id: input.id };
  });

export default adminDeleteGroupCostLine;

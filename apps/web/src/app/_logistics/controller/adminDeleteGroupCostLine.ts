import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsGroupCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { deleteGroupCostLineSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Delete a group cost line.
 */
const adminDeleteGroupCostLine = adminProcedure
  .input(deleteGroupCostLineSchema)
  .mutation(async ({ input }) => {
    await db.delete(logisticsGroupCostLines).where(eq(logisticsGroupCostLines.id, input.id));
    return { id: input.id };
  });

export default adminDeleteGroupCostLine;

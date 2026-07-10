import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentGroups, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { deleteShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Delete a consolidation group. Member shipments are unassigned (group_id set
 * null) rather than deleted; previously-written landed costs are left as-is.
 */
const adminDeleteShipmentGroup = adminProcedure
  .input(deleteShipmentGroupSchema)
  .mutation(async ({ input }) => {
    await db
      .update(logisticsShipments)
      .set({ groupId: null, updatedAt: new Date() })
      .where(eq(logisticsShipments.groupId, input.id));

    await db.delete(logisticsShipmentGroups).where(eq(logisticsShipmentGroups.id, input.id));

    return { id: input.id };
  });

export default adminDeleteShipmentGroup;

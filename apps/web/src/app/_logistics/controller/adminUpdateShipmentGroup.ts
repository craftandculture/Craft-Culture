import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentGroups, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Update a group's details, shared costs, and/or shipment membership.
 * When `shipmentIds` is supplied it replaces the membership entirely.
 */
const adminUpdateShipmentGroup = adminProcedure
  .input(updateShipmentGroupSchema)
  .mutation(async ({ input }) => {
    const { id, shipmentIds, ...fields } = input;

    // Only touch keys the client actually sent (undefined = leave unchanged).
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    const [group] = await db
      .update(logisticsShipmentGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(logisticsShipmentGroups.id, id))
      .returning();

    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
    }

    if (shipmentIds !== undefined) {
      // Clear current membership, then assign the new set.
      await db
        .update(logisticsShipments)
        .set({ groupId: null, updatedAt: new Date() })
        .where(eq(logisticsShipments.groupId, id));

      if (shipmentIds.length > 0) {
        await db
          .update(logisticsShipments)
          .set({ groupId: id, updatedAt: new Date() })
          .where(inArray(logisticsShipments.id, shipmentIds));
      }
    }

    return group;
  });

export default adminUpdateShipmentGroup;

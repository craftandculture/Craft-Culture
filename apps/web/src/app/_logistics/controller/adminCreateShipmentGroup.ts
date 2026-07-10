import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentGroups, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Create a consolidation group and (optionally) assign shipments to it.
 * Costs are added later, then allocated across every bottle in the group.
 */
const adminCreateShipmentGroup = adminProcedure
  .input(createShipmentGroupSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { name, reference, notes, shipmentIds } = input;

    const [group] = await db
      .insert(logisticsShipmentGroups)
      .values({
        name,
        reference: reference ?? null,
        notes: notes ?? null,
        createdBy: user.id,
      })
      .returning();

    if (!group) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create group' });
    }

    if (shipmentIds.length > 0) {
      await db
        .update(logisticsShipments)
        .set({ groupId: group.id, updatedAt: new Date() })
        .where(inArray(logisticsShipments.id, shipmentIds));
    }

    return group;
  });

export default adminCreateShipmentGroup;

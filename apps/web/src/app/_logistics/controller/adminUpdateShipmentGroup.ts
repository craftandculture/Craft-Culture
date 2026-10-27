import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import db from '@/database/client';
import { logisticsShipmentGroups, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';
import recalcGroupLandedCost from '../utils/recalcGroupLandedCost';

/**
 * Update a group's details, shared costs, and/or shipment membership.
 * When `shipmentIds` is supplied it replaces the membership entirely; the
 * group's landed cost is then re-allocated, as is that of any group a
 * shipment was moved out of. When the group has a reference it is copied onto
 * members' AWB (air) or container number (sea) where those are still empty.
 */
const adminUpdateShipmentGroup = adminProcedure
  .input(updateShipmentGroupSchema)
  .mutation(async ({ input }) => {
    const { id, shipmentIds, ...fields } = input;

    // Only touch keys the client actually sent (undefined = leave unchanged).
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    // Membership and references change together or not at all
    const { group, sourceGroupIds } = await db.transaction(async (tx) => {
      const [group] = await tx
        .update(logisticsShipmentGroups)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(logisticsShipmentGroups.id, id))
        .returning();

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      // Groups that lose a shipment to this one need re-allocating too.
      const sourceGroupIds = new Set<string>();

      if (shipmentIds !== undefined) {
        if (shipmentIds.length > 0) {
          const moving = await tx
            .select({ groupId: logisticsShipments.groupId })
            .from(logisticsShipments)
            .where(
              and(
                inArray(logisticsShipments.id, shipmentIds),
                isNotNull(logisticsShipments.groupId),
                ne(logisticsShipments.groupId, id),
              ),
            );
          for (const m of moving) if (m.groupId) sourceGroupIds.add(m.groupId);
        }

        // Clear current membership, then assign the new set.
        await tx
          .update(logisticsShipments)
          .set({ groupId: null, updatedAt: new Date() })
          .where(eq(logisticsShipments.groupId, id));

        if (shipmentIds.length > 0) {
          await tx
            .update(logisticsShipments)
            .set({ groupId: id, updatedAt: new Date() })
            .where(inArray(logisticsShipments.id, shipmentIds));
        }
      }

      if (group.reference?.trim() && (shipmentIds !== undefined || fields.reference !== undefined)) {
        const ref = group.reference.trim();
        const isBlank = (col: AnyPgColumn) =>
          or(sql`${col} IS NULL`, sql`TRIM(${col}) = ''`);

        await tx
          .update(logisticsShipments)
          .set({ awbNumber: ref, updatedAt: new Date() })
          .where(
            and(
              eq(logisticsShipments.groupId, id),
              eq(logisticsShipments.transportMode, 'air'),
              isBlank(logisticsShipments.awbNumber),
            ),
          );
        await tx
          .update(logisticsShipments)
          .set({ containerNumber: ref, updatedAt: new Date() })
          .where(
            and(
              eq(logisticsShipments.groupId, id),
              inArray(logisticsShipments.transportMode, ['sea_fcl', 'sea_lcl']),
              isBlank(logisticsShipments.containerNumber),
            ),
          );
      }

      return { group, sourceGroupIds };
    });

    if (shipmentIds !== undefined) {
      // Best-effort: a failed re-allocation shows as "Costs out of date" on the
      // group page rather than failing the membership change.
      for (const gid of [id, ...sourceGroupIds]) {
        try {
          await recalcGroupLandedCost(gid, { skipUnallocated: true });
        } catch (error) {
          console.error('Failed to re-allocate landed cost after membership change', {
            error,
            groupId: gid,
          });
        }
      }
    }

    return group;
  });

export default adminUpdateShipmentGroup;

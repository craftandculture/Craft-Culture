import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import db from '@/database/client';
import { logisticsShipmentGroups, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';
import recalcGroupLandedCost from '../utils/recalcGroupLandedCost';

/**
 * Create a consolidation group and (optionally) assign shipments to it.
 * Costs are added later, then allocated across every bottle in the group.
 * Any group a shipment is moved out of is re-allocated, and the group's
 * reference is copied onto members' empty AWB (air) or container number (sea).
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
      const moving = await db
        .select({ groupId: logisticsShipments.groupId })
        .from(logisticsShipments)
        .where(
          and(
            inArray(logisticsShipments.id, shipmentIds),
            isNotNull(logisticsShipments.groupId),
          ),
        );
      const sourceGroupIds = new Set(
        moving.map((m) => m.groupId).filter((g): g is string => !!g),
      );

      await db
        .update(logisticsShipments)
        .set({ groupId: group.id, updatedAt: new Date() })
        .where(inArray(logisticsShipments.id, shipmentIds));

      const ref = group.reference?.trim();
      if (ref) {
        const isBlank = (col: AnyPgColumn) =>
          or(sql`${col} IS NULL`, sql`TRIM(${col}) = ''`);
        await db
          .update(logisticsShipments)
          .set({ awbNumber: ref, updatedAt: new Date() })
          .where(
            and(
              eq(logisticsShipments.groupId, group.id),
              eq(logisticsShipments.transportMode, 'air'),
              isBlank(logisticsShipments.awbNumber),
            ),
          );
        await db
          .update(logisticsShipments)
          .set({ containerNumber: ref, updatedAt: new Date() })
          .where(
            and(
              eq(logisticsShipments.groupId, group.id),
              inArray(logisticsShipments.transportMode, ['sea_fcl', 'sea_lcl']),
              isBlank(logisticsShipments.containerNumber),
            ),
          );
      }

      // A new group has no costs yet, so only the groups that lost a shipment
      // need re-allocating.
      for (const gid of sourceGroupIds) {
        try {
          await recalcGroupLandedCost(gid, { skipUnallocated: true });
        } catch (error) {
          console.error('Failed to re-allocate landed cost after moving shipments', {
            error,
            groupId: gid,
          });
        }
      }
    }

    return group;
  });

export default adminCreateShipmentGroup;

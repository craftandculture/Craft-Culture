import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentGroups,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { calculateShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';
import calculateLandedCost from '../utils/calculateLandedCost';

/**
 * Allocate a group's shared freight & logistics costs across every bottle in
 * all member shipments, writing landed cost per bottle onto each item. The
 * group's cost fields drive the allocation; product cost comes from the items.
 */
const adminCalculateShipmentGroup = adminProcedure
  .input(calculateShipmentGroupSchema)
  .mutation(async ({ input }) => {
    const [group] = await db
      .select()
      .from(logisticsShipmentGroups)
      .where(eq(logisticsShipmentGroups.id, input.id));

    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
    }

    const shipments = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.groupId, group.id));

    if (shipments.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Group has no shipments. Add shipments before allocating costs.',
      });
    }

    const shipmentIds = shipments.map((s) => s.id);
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(inArray(logisticsShipmentItems.shipmentId, shipmentIds));

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The grouped shipments have no items to allocate costs to.',
      });
    }

    // The group satisfies LandedCostSource (same cost fields as a shipment),
    // so the shared engine spreads its costs across the pooled items.
    const result = calculateLandedCost(group, items);

    for (const itemResult of result.items) {
      await db
        .update(logisticsShipmentItems)
        .set({
          freightAllocated: itemResult.freightAllocated,
          handlingAllocated: itemResult.handlingAllocated,
          insuranceAllocated: itemResult.insuranceAllocated,
          govFeesAllocated: itemResult.govFeesAllocated,
          landedCostTotal: itemResult.landedCostTotal,
          landedCostPerBottle: itemResult.landedCostPerBottle,
          marginPerBottle: itemResult.marginPerBottle,
          marginPercent: itemResult.marginPercent,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipmentItems.id, itemResult.itemId));
    }

    const totalBottles = result.items.reduce((sum, r) => sum + r.totalBottles, 0);
    const totalCases = shipments.reduce((sum, s) => sum + (s.totalCases ?? 0), 0);

    await db
      .update(logisticsShipmentGroups)
      .set({
        totalLandedCostUsd: result.totalLandedCost,
        totalBottles,
        totalCases,
        allocatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipmentGroups.id, group.id));

    return { ...result, totalBottles, totalCases };
  });

export default adminCalculateShipmentGroup;

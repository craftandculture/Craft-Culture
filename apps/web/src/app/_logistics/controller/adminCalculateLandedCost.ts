import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsGroupCostLines,
  logisticsShipmentGroups,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import calculateLandedCost from '../utils/calculateLandedCost';

const calculateLandedCostSchema = z.object({
  shipmentId: z.string().uuid(),
});

/**
 * Calculate and save landed costs for a shipment
 *
 * Calculates landed cost per bottle for all items in a shipment
 * and updates both the shipment and item records with the results, in one
 * transaction so a failure part-way leaves the previous figures in place.
 *
 * A shipment in a consolidation group whose freight has been allocated takes
 * its landed cost from the group, so it is refused here with a pointer to the
 * group page rather than overwriting the group's allocation.
 */
const adminCalculateLandedCost = adminProcedure
  .input(calculateLandedCostSchema)
  .mutation(async ({ input }) => {
    const { shipmentId } = input;

    // Get shipment with items
    const shipment = await db.query.logisticsShipments.findFirst({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    const items = await db.query.logisticsShipmentItems.findMany({
      where: { shipmentId },
    });

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Shipment has no items. Add items before calculating landed cost.',
      });
    }

    if (shipment.groupId) {
      const [group] = await db
        .select({ name: logisticsShipmentGroups.name, allocatedAt: logisticsShipmentGroups.allocatedAt })
        .from(logisticsShipmentGroups)
        .where(eq(logisticsShipmentGroups.id, shipment.groupId));
      const [groupLine] = await db
        .select({ id: logisticsGroupCostLines.id })
        .from(logisticsGroupCostLines)
        .where(eq(logisticsGroupCostLines.groupId, shipment.groupId))
        .limit(1);

      if (group && (group.allocatedAt || groupLine)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `This shipment's landed cost comes from its consolidation group (${group.name}). Recalculate it on the group page.`,
        });
      }
    }

    // Calculate landed costs
    const result = calculateLandedCost(shipment, items);

    await db.transaction(async (tx) => {
      // Update shipment with total landed cost
      await tx
        .update(logisticsShipments)
        .set({
          totalLandedCostUsd: result.totalLandedCost,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipments.id, shipmentId));

      // Update each item with allocated costs
      for (const itemResult of result.items) {
        await tx
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
    });

    return result;
  });

export default adminCalculateLandedCost;

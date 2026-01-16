import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import calculateLandedCost from '../utils/calculateLandedCost';

const calculateLandedCostSchema = z.object({
  shipmentId: z.string().uuid(),
});

/**
 * Calculate and save landed costs for a shipment
 *
 * Calculates landed cost per bottle for all items in a shipment
 * and updates both the shipment and item records with the results.
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

    // Calculate landed costs
    const result = calculateLandedCost(shipment, items);

    // Update shipment with total landed cost
    await db
      .update(logisticsShipments)
      .set({
        totalLandedCostUsd: result.totalLandedCost,
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipments.id, shipmentId));

    // Update each item with allocated costs
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

    return result;
  });

export default adminCalculateLandedCost;

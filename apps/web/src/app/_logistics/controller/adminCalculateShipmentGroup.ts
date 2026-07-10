import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsGroupCostLines,
  logisticsShipmentGroups,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { calculateShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';

const round2 = (n: number) => Math.round(n * 100) / 100;
const bottlesOf = (i: { totalBottles: number | null; cases: number; bottlesPerCase: number | null }) =>
  i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);

/**
 * Allocate a group's logistics cost ledger across every bottle and write the
 * landed cost per bottle onto each item. Shared cost lines spread across all
 * bottles in the group; per-shipment lines spread only within their shipment.
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

    const costLines = await db
      .select()
      .from(logisticsGroupCostLines)
      .where(eq(logisticsGroupCostLines.groupId, group.id));

    const sharedUsd = costLines
      .filter((l) => l.scope === 'shared')
      .reduce((s, l) => s + l.amountUsd, 0);
    const directByShipment = new Map<string, number>();
    for (const l of costLines) {
      if (l.scope === 'shipment' && l.shipmentId) {
        directByShipment.set(l.shipmentId, (directByShipment.get(l.shipmentId) ?? 0) + l.amountUsd);
      }
    }

    const totalBottles = items.reduce((s, i) => s + bottlesOf(i), 0);
    const bottlesByShipment = new Map<string, number>();
    for (const i of items) {
      bottlesByShipment.set(i.shipmentId, (bottlesByShipment.get(i.shipmentId) ?? 0) + bottlesOf(i));
    }

    let totalProductCost = 0;
    let totalFreight = 0;

    for (const item of items) {
      const bottles = bottlesOf(item);
      const productCost = bottles * (item.productCostPerBottle ?? 0);
      // Shared costs spread across every bottle; direct costs only within the
      // item's own shipment.
      const sharedShare = totalBottles > 0 ? sharedUsd * (bottles / totalBottles) : 0;
      const shipBottles = bottlesByShipment.get(item.shipmentId) ?? 0;
      const directShare =
        shipBottles > 0
          ? (directByShipment.get(item.shipmentId) ?? 0) * (bottles / shipBottles)
          : 0;
      const freight = sharedShare + directShare;
      const landedTotal = productCost + freight;

      totalProductCost += productCost;
      totalFreight += freight;

      await db
        .update(logisticsShipmentItems)
        .set({
          freightAllocated: round2(freight),
          landedCostTotal: round2(landedTotal),
          landedCostPerBottle: bottles > 0 ? round2(landedTotal / bottles) : 0,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipmentItems.id, item.id));
    }

    const totalCases = items.reduce((s, i) => s + (i.cases ?? 0), 0);

    await db
      .update(logisticsShipmentGroups)
      .set({
        totalLandedCostUsd: round2(totalProductCost + totalFreight),
        totalBottles,
        totalCases,
        allocatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipmentGroups.id, group.id));

    return {
      totalProductCost: round2(totalProductCost),
      totalFreight: round2(totalFreight),
      totalLanded: round2(totalProductCost + totalFreight),
      totalBottles,
      totalCases,
      perBottleFreight: totalBottles > 0 ? round2(totalFreight / totalBottles) : 0,
    };
  });

export default adminCalculateShipmentGroup;

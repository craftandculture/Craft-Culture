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
/** 75cl-equivalent units — a 1500ml magnum = 2, a 3000ml = 4, etc. Freight is
 * split on this so larger formats carry their fair share. */
const equivOf = (i: {
  totalBottles: number | null;
  cases: number;
  bottlesPerCase: number | null;
  bottleSizeMl: number | null;
}) => bottlesOf(i) * ((i.bottleSizeMl ?? 750) / 750);

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
    const totalEquiv = items.reduce((s, i) => s + equivOf(i), 0);
    const equivByShipment = new Map<string, number>();
    for (const i of items) {
      equivByShipment.set(i.shipmentId, (equivByShipment.get(i.shipmentId) ?? 0) + equivOf(i));
    }

    let totalProductCost = 0;
    let totalFreight = 0;
    const landedByShipment = new Map<string, number>();

    for (const item of items) {
      const bottles = bottlesOf(item);
      const eq = equivOf(item);
      const productCost = bottles * (item.productCostPerBottle ?? 0);
      // Freight is split by 75cl-equivalent (magnum = 2, etc.): shared across
      // the whole group, direct only within the item's own shipment.
      const sharedShare = totalEquiv > 0 ? sharedUsd * (eq / totalEquiv) : 0;
      const shipEquiv = equivByShipment.get(item.shipmentId) ?? 0;
      const directShare =
        shipEquiv > 0 ? (directByShipment.get(item.shipmentId) ?? 0) * (eq / shipEquiv) : 0;
      const freight = sharedShare + directShare;
      const landedTotal = productCost + freight;

      totalProductCost += productCost;
      totalFreight += freight;
      landedByShipment.set(
        item.shipmentId,
        (landedByShipment.get(item.shipmentId) ?? 0) + landedTotal,
      );

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

    // Keep each member shipment's header landed cost in step with its share,
    // so the shipment Costs tab (and anything reading the header) is correct.
    for (const shipment of shipments) {
      await db
        .update(logisticsShipments)
        .set({
          totalLandedCostUsd: round2(landedByShipment.get(shipment.id) ?? 0),
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipments.id, shipment.id));
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

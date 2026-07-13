import { TRPCError } from '@trpc/server';
import { asc, desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsGroupCostLines,
  logisticsShipmentGroups,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Get one consolidation group with its member shipments and their items,
 * so the group page can show the bottles the costs will be spread across.
 */
const adminGetShipmentGroup = adminProcedure
  .input(getShipmentGroupSchema)
  .query(async ({ input }) => {
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
      .where(eq(logisticsShipments.groupId, group.id))
      .orderBy(asc(logisticsShipments.shipmentNumber));

    const shipmentIds = shipments.map((s) => s.id);
    const items = shipmentIds.length
      ? await db
          .select()
          .from(logisticsShipmentItems)
          .where(inArray(logisticsShipmentItems.shipmentId, shipmentIds))
      : [];

    const shipmentsWithItems = shipments.map((s) => ({
      ...s,
      items: items.filter((i) => i.shipmentId === s.id),
    }));

    // Live totals straight off the items so the group summary stays in step
    // with item edits without needing a re-allocation.
    const totalBottles = items.reduce(
      (sum, i) => sum + (i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12)),
      0,
    );
    const totalCases = items.reduce((sum, i) => sum + (i.cases ?? 0), 0);
    // 75cl-equivalent units (magnum = 2, etc.) — the basis for freight/bottle.
    const total75cl = items.reduce(
      (sum, i) =>
        sum +
        (i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12)) * ((i.bottleSizeMl ?? 750) / 750),
      0,
    );
    const totalProductCost = items.reduce((sum, i) => {
      const bottles = i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);
      return sum + bottles * (i.productCostPerBottle ?? 0);
    }, 0);

    // Logistics cost ledger + derived per-unit metrics
    const costLines = await db
      .select()
      .from(logisticsGroupCostLines)
      .where(eq(logisticsGroupCostLines.groupId, group.id))
      .orderBy(desc(logisticsGroupCostLines.createdAt));

    const sharedUsd = costLines
      .filter((l) => l.scope === 'shared')
      .reduce((s, l) => s + l.amountUsd, 0);
    const shipmentDirectUsd = costLines
      .filter((l) => l.scope === 'shipment')
      .reduce((s, l) => s + l.amountUsd, 0);
    const totalLogisticsUsd = sharedUsd + shipmentDirectUsd;

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const metrics = {
      sharedUsd: round2(sharedUsd),
      shipmentDirectUsd: round2(shipmentDirectUsd),
      totalLogisticsUsd: round2(totalLogisticsUsd),
      // Freight per 75cl-equivalent bottle (magnums etc. weighted up)
      perBottle: total75cl ? round2(totalLogisticsUsd / total75cl) : null,
      perCase: totalCases ? round2(totalLogisticsUsd / totalCases) : null,
      perKg: group.chargeableWeightKg
        ? round2(totalLogisticsUsd / group.chargeableWeightKg)
        : null,
    };

    return {
      group,
      shipments: shipmentsWithItems,
      itemCount: items.length,
      totalBottles,
      totalCases,
      totalProductCost,
      costLines,
      metrics,
    };
  });

export default adminGetShipmentGroup;

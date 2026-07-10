import { TRPCError } from '@trpc/server';
import { asc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
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

    const totalBottles = items.reduce(
      (sum, i) => sum + (i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12)),
      0,
    );

    return { group, shipments: shipmentsWithItems, itemCount: items.length, totalBottles };
  });

export default adminGetShipmentGroup;

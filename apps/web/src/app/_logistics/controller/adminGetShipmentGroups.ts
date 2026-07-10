import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentGroups, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * List consolidation groups with a live count of member shipments and their
 * combined cases/bottles (for the groups index page).
 */
const adminGetShipmentGroups = adminProcedure.query(async () => {
  const groups = await db
    .select({
      id: logisticsShipmentGroups.id,
      name: logisticsShipmentGroups.name,
      reference: logisticsShipmentGroups.reference,
      costAllocationMethod: logisticsShipmentGroups.costAllocationMethod,
      totalLandedCostUsd: logisticsShipmentGroups.totalLandedCostUsd,
      allocatedAt: logisticsShipmentGroups.allocatedAt,
      createdAt: logisticsShipmentGroups.createdAt,
      shipmentCount: sql<number>`COUNT(${logisticsShipments.id})::int`,
      totalCases: sql<number>`COALESCE(SUM(${logisticsShipments.totalCases}), 0)::int`,
      totalBottles: sql<number>`COALESCE(SUM(${logisticsShipments.totalBottles}), 0)::int`,
    })
    .from(logisticsShipmentGroups)
    .leftJoin(logisticsShipments, eq(logisticsShipments.groupId, logisticsShipmentGroups.id))
    .groupBy(logisticsShipmentGroups.id)
    .orderBy(desc(logisticsShipmentGroups.createdAt));

  return groups;
});

export default adminGetShipmentGroups;

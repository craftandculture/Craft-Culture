import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsJobs,
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getShipmentsSchema, { SHIPMENT_STAGE_GROUPS, type ShipmentStageGroup } from '../schemas/getShipmentsSchema';
import { partyLogoSql, partyNameSql } from '../utils/shipmentPartySql';

/**
 * Get list of shipments with pagination and filters
 *
 * @example
 *   await trpcClient.logistics.admin.getMany.query({
 *     limit: 20,
 *     cursor: 0,
 *     status: "in_transit",
 *     type: "inbound"
 *   });
 */
const adminGetMany = adminProcedure.input(getShipmentsSchema).query(async ({ input }) => {
  const { limit, cursor, search, status, stage, type, transportMode, partnerId, sort } = input;

  // Every filter but the status ones; the tile counts are taken over these, so
  // each tile says how many it would show when pressed
  const conditions = [];

  if (type) {
    conditions.push(eq(logisticsShipments.type, type));
  }

  if (transportMode) {
    conditions.push(eq(logisticsShipments.transportMode, transportMode));
  }

  if (partnerId) {
    conditions.push(eq(logisticsShipments.partnerId, partnerId));
  }

  if (search) {
    conditions.push(
      or(
        ilike(logisticsShipments.shipmentNumber, `%${search}%`),
        ilike(logisticsShipments.name, `%${search}%`),
        ilike(logisticsShipments.hillebrandReference, `%${search}%`),
        ilike(logisticsShipments.carrierName, `%${search}%`),
        ilike(logisticsShipments.carrierBookingRef, `%${search}%`),
        ilike(logisticsShipments.containerNumber, `%${search}%`),
        ilike(logisticsShipments.blNumber, `%${search}%`),
        ilike(logisticsShipments.awbNumber, `%${search}%`),
        ilike(logisticsShipments.originCity, `%${search}%`),
        ilike(logisticsShipments.destinationCity, `%${search}%`),
        // Partner, the supplier Hillebrand names, and any wine on the shipment
        ilike(partners.businessName, `%${search}%`),
        ilike(logisticsJobs.clientName, `%${search}%`),
        ilike(logisticsShipments.partnerNotes, `%${search}%`),
        sql`EXISTS (
          SELECT 1 FROM ${logisticsShipmentItems}
          WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
            AND (${logisticsShipmentItems.productName} ILIKE ${`%${search}%`}
              OR ${logisticsShipmentItems.producer} ILIKE ${`%${search}%`})
        )`,
      )!,
    );
  }

  const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

  const statusConditions = [
    ...conditions,
    ...(status ? [eq(logisticsShipments.status, status)] : []),
    ...(stage ? [inArray(logisticsShipments.status, [...SHIPMENT_STAGE_GROUPS[stage]])] : []),
  ];
  const whereClause = statusConditions.length > 0 ? and(...statusConditions) : undefined;

  const byStatus = await db
    .select({ status: logisticsShipments.status, count: sql<number>`count(*)` })
    .from(logisticsShipments)
    .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
    .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id))
    .where(baseWhere)
    .groupBy(logisticsShipments.status);

  const stageCounts = Object.fromEntries(
    (Object.keys(SHIPMENT_STAGE_GROUPS) as ShipmentStageGroup[]).map((key) => [
      key,
      byStatus
        .filter((r) => (SHIPMENT_STAGE_GROUPS[key] as readonly string[]).includes(r.status))
        .reduce((n, r) => n + Number(r.count), 0),
    ]),
  ) as Record<ShipmentStageGroup, number>;

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(logisticsShipments)
    .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
    .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id))
    .where(whereClause);

  const totalCount = Number(countResult?.count ?? 0);

  // Get shipments with pagination
  const shipmentsList = await db
    .select({
      shipment: logisticsShipments,
      // Case/bottle totals derived from line items (authoritative). The
      // denormalized header counters drift (increment bugs) and are set
      // inconsistently across ingestion paths (Hillebrand sync, PDF extract,
      // manual add), so only fall back to them when a shipment has no items.
      itemCases: sql<number>`COALESCE((
        SELECT SUM(${logisticsShipmentItems.cases})
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
      ), ${logisticsShipments.totalCases}, 0)`,
      itemBottles: sql<number>`COALESCE((
        SELECT SUM(COALESCE(
          ${logisticsShipmentItems.totalBottles},
          ${logisticsShipmentItems.cases} * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
        ))
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
      ), ${logisticsShipments.totalBottles}, 0)`,
      partner: {
        id: partners.id,
        businessName: partners.businessName,
        type: partners.type,
      },
      createdByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
      jobNumber: logisticsJobs.jobNumber,
      partyName: partyNameSql,
      partyLogoUrl: partyLogoSql,
    })
    .from(logisticsShipments)
    .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
    .leftJoin(users, eq(logisticsShipments.createdBy, users.id))
    .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id))
    .where(whereClause)
    .orderBy(
      ...(sort === 'eta'
        ? [sql`${logisticsShipments.eta} IS NULL`, asc(logisticsShipments.eta)]
        : [desc(logisticsShipments.createdAt)]),
    )
    .limit(limit)
    .offset(cursor);

  // Flatten response
  const shipmentsWithRelations = shipmentsList.map((row) => ({
    ...row.shipment,
    totalCases: Number(row.itemCases),
    totalBottles: Number(row.itemBottles),
    partner: row.partner,
    createdByUser: row.createdByUser,
    jobNumber: row.jobNumber,
    partyName: row.partyName,
    partyLogoUrl: row.partyLogoUrl,
  }));

  const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

  return {
    data: shipmentsWithRelations,
    meta: {
      totalCount,
      nextCursor,
      hasMore: nextCursor !== null,
      stageCounts,
    },
  };
});

export default adminGetMany;

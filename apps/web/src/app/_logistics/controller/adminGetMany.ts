import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments, partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getShipmentsSchema from '../schemas/getShipmentsSchema';

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
  const { limit, cursor, search, status, type, transportMode, partnerId } = input;

  // Build where conditions
  const conditions = [];

  if (status) {
    conditions.push(eq(logisticsShipments.status, status));
  }

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
        ilike(logisticsShipments.carrierName, `%${search}%`),
        ilike(logisticsShipments.carrierBookingRef, `%${search}%`),
        ilike(logisticsShipments.containerNumber, `%${search}%`),
        ilike(logisticsShipments.blNumber, `%${search}%`),
        ilike(logisticsShipments.awbNumber, `%${search}%`),
        ilike(logisticsShipments.originCity, `%${search}%`),
        ilike(logisticsShipments.destinationCity, `%${search}%`),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(logisticsShipments)
    .where(whereClause);

  const totalCount = Number(countResult?.count ?? 0);

  // Get shipments with pagination
  const shipmentsList = await db
    .select({
      shipment: logisticsShipments,
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
    })
    .from(logisticsShipments)
    .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
    .leftJoin(users, eq(logisticsShipments.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(logisticsShipments.createdAt))
    .limit(limit)
    .offset(cursor);

  // Flatten response
  const shipmentsWithRelations = shipmentsList.map((row) => ({
    ...row.shipment,
    partner: row.partner,
    createdByUser: row.createdByUser,
  }));

  const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

  return {
    data: shipmentsWithRelations,
    meta: {
      totalCount,
      nextCursor,
      hasMore: nextCursor !== null,
    },
  };
});

export default adminGetMany;

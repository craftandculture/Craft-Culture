import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsLocations, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getMovementHistorySchema } from '../schemas/stockQuerySchema';

/**
 * Get stock movement history with filtering and pagination
 * Full audit trail of all warehouse operations
 *
 * @example
 *   await trpcClient.wms.admin.stock.getMovements.query({
 *     movementType: "transfer",
 *     limit: 50
 *   });
 */
const adminGetMovementHistory = adminProcedure
  .input(getMovementHistorySchema)
  .query(async ({ input }) => {
    const { movementType, lwin18, locationId, dateFrom, dateTo, limit, offset } = input;

    const conditions = [];

    if (movementType) {
      conditions.push(eq(wmsStockMovements.movementType, movementType));
    }

    if (lwin18) {
      conditions.push(eq(wmsStockMovements.lwin18, lwin18));
    }

    if (locationId) {
      conditions.push(
        sql`(${wmsStockMovements.fromLocationId} = ${locationId} OR ${wmsStockMovements.toLocationId} = ${locationId})`,
      );
    }

    if (dateFrom) {
      conditions.push(gte(wmsStockMovements.performedAt, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(wmsStockMovements.performedAt, dateTo));
    }

    // Get movements with user info
    const movements = await db
      .select({
        id: wmsStockMovements.id,
        movementNumber: wmsStockMovements.movementNumber,
        movementType: wmsStockMovements.movementType,
        lwin18: wmsStockMovements.lwin18,
        productName: wmsStockMovements.productName,
        quantityCases: wmsStockMovements.quantityCases,
        fromLocationId: wmsStockMovements.fromLocationId,
        toLocationId: wmsStockMovements.toLocationId,
        lotNumber: wmsStockMovements.lotNumber,
        notes: wmsStockMovements.notes,
        reasonCode: wmsStockMovements.reasonCode,
        performedAt: wmsStockMovements.performedAt,
        performedById: wmsStockMovements.performedBy,
        performedByName: users.name,
        performedByEmail: users.email,
      })
      .from(wmsStockMovements)
      .leftJoin(users, eq(users.id, wmsStockMovements.performedBy))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(wmsStockMovements.performedAt))
      .limit(limit)
      .offset(offset);

    // Get location codes for the movements
    const locationIds = new Set<string>();
    movements.forEach((m) => {
      if (m.fromLocationId) locationIds.add(m.fromLocationId);
      if (m.toLocationId) locationIds.add(m.toLocationId);
    });

    const locationMap = new Map<string, string>();
    if (locationIds.size > 0) {
      const locations = await db
        .select({
          id: wmsLocations.id,
          locationCode: wmsLocations.locationCode,
        })
        .from(wmsLocations)
        .where(sql`${wmsLocations.id} IN (${sql.join([...locationIds].map((id) => sql`${id}`), sql`, `)})`);

      locations.forEach((loc) => {
        locationMap.set(loc.id, loc.locationCode);
      });
    }

    // Enrich movements with location codes
    const enrichedMovements = movements.map((m) => ({
      ...m,
      fromLocationCode: m.fromLocationId ? locationMap.get(m.fromLocationId) : null,
      toLocationCode: m.toLocationId ? locationMap.get(m.toLocationId) : null,
      performedBy: {
        id: m.performedById,
        name: m.performedByName,
        email: m.performedByEmail,
      },
    }));

    // Get total count
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(wmsStockMovements)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get movement type summary
    const typeSummary = await db
      .select({
        movementType: wmsStockMovements.movementType,
        count: sql<number>`COUNT(*)::int`,
        totalCases: sql<number>`SUM(${wmsStockMovements.quantityCases})::int`,
      })
      .from(wmsStockMovements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(wmsStockMovements.movementType)
      .orderBy(desc(sql`COUNT(*)`));

    return {
      movements: enrichedMovements,
      pagination: {
        total: countResult?.count ?? 0,
        limit,
        offset,
        hasMore: offset + movements.length < (countResult?.count ?? 0),
      },
      summary: typeSummary,
    };
  });

export default adminGetMovementHistory;

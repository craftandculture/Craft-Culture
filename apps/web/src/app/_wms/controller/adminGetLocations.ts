import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getLocationsSchema } from '../schemas/locationSchema';

/**
 * Get warehouse locations with optional filters
 *
 * @example
 *   await trpcClient.wms.admin.locations.getMany.query({
 *     aisle: "A",
 *     isActive: true
 *   });
 */
const adminGetLocations = adminProcedure
  .input(getLocationsSchema)
  .query(async ({ input }) => {
    console.log('[WMS] adminGetLocations called with input:', input);
    const startTime = Date.now();
    const conditions = [];

    if (input.aisle) {
      conditions.push(eq(wmsLocations.aisle, input.aisle.toUpperCase()));
    }

    if (input.locationType) {
      conditions.push(eq(wmsLocations.locationType, input.locationType));
    }

    if (typeof input.isActive === 'boolean') {
      conditions.push(eq(wmsLocations.isActive, input.isActive));
    }

    if (input.search) {
      conditions.push(
        or(
          ilike(wmsLocations.locationCode, `%${input.search}%`),
          ilike(wmsLocations.barcode, `%${input.search}%`),
          ilike(wmsLocations.notes, `%${input.search}%`),
        ),
      );
    }

    // Get locations with stock count
    const locations = await db
      .select({
        id: wmsLocations.id,
        locationCode: wmsLocations.locationCode,
        aisle: wmsLocations.aisle,
        bay: wmsLocations.bay,
        level: wmsLocations.level,
        locationType: wmsLocations.locationType,
        capacityCases: wmsLocations.capacityCases,
        requiresForklift: wmsLocations.requiresForklift,
        isActive: wmsLocations.isActive,
        barcode: wmsLocations.barcode,
        notes: wmsLocations.notes,
        createdAt: wmsLocations.createdAt,
        updatedAt: wmsLocations.updatedAt,
        totalCases: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
        productCount: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
      })
      .from(wmsLocations)
      .leftJoin(wmsStock, eq(wmsStock.locationId, wmsLocations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(wmsLocations.id)
      .orderBy(
        asc(wmsLocations.aisle),
        asc(wmsLocations.bay),
        asc(wmsLocations.level),
      );

    console.log('[WMS] adminGetLocations returning', locations.length, 'locations in', Date.now() - startTime, 'ms');
    return locations;
  });

export default adminGetLocations;

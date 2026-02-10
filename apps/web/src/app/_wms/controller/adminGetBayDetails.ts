import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get bay details - all locations in a bay with their settings
 *
 * @example
 *   await trpcClient.wms.admin.locations.getBayDetails.query({
 *     aisle: 'A',
 *     bay: '01'
 *   });
 */
const adminGetBayDetails = adminProcedure
  .input(
    z.object({
      aisle: z.string().min(1).max(10),
      bay: z.string().min(1).max(10),
    }),
  )
  .query(async ({ input }) => {
    const aisle = input.aisle.toUpperCase();
    const bay = input.bay;

    const locations = await db
      .select({
        id: wmsLocations.id,
        locationCode: wmsLocations.locationCode,
        level: wmsLocations.level,
        storageMethod: wmsLocations.storageMethod,
        requiresForklift: wmsLocations.requiresForklift,
        isActive: wmsLocations.isActive,
      })
      .from(wmsLocations)
      .where(and(eq(wmsLocations.aisle, aisle), eq(wmsLocations.bay, bay)))
      .orderBy(wmsLocations.level);

    if (locations.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Bay ${aisle}-${bay} not found`,
      });
    }

    // Determine current settings (use first non-null value found)
    const storageMethod = locations.find((l) => l.storageMethod)?.storageMethod || 'shelf';

    // Find the lowest level that requires forklift
    const forkliftLevels = locations
      .filter((l) => l.requiresForklift)
      .map((l) => l.level)
      .sort();
    const forkliftFromLevel = forkliftLevels[0] || null;

    return {
      aisle,
      bay,
      locations,
      settings: {
        storageMethod,
        forkliftFromLevel,
      },
    };
  });

export default adminGetBayDetails;

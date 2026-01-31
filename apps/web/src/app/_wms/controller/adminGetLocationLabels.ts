import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get location labels for printing
 *
 * @example
 *   // Get all active locations
 *   await trpcClient.wms.admin.labels.getLocationLabels.query({});
 *
 *   // Get specific locations
 *   await trpcClient.wms.admin.labels.getLocationLabels.query({ locationIds: ["uuid1", "uuid2"] });
 */
const adminGetLocationLabels = adminProcedure
  .input(
    z
      .object({
        locationIds: z.array(z.string().uuid()).optional(),
        locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']).optional(),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const conditions = [eq(wmsLocations.isActive, true)];

    if (input?.locationIds?.length) {
      conditions.push(inArray(wmsLocations.id, input.locationIds));
    }

    if (input?.locationType) {
      conditions.push(eq(wmsLocations.locationType, input.locationType));
    }

    const locations = await db
      .select({
        id: wmsLocations.id,
        locationCode: wmsLocations.locationCode,
        barcode: wmsLocations.barcode,
        aisle: wmsLocations.aisle,
        bay: wmsLocations.bay,
        level: wmsLocations.level,
        locationType: wmsLocations.locationType,
        requiresForklift: wmsLocations.requiresForklift,
      })
      .from(wmsLocations)
      .where(and(...conditions))
      .orderBy(wmsLocations.aisle, wmsLocations.bay, wmsLocations.level);

    return {
      locations,
      totalLabels: locations.length,
    };
  });

export default adminGetLocationLabels;

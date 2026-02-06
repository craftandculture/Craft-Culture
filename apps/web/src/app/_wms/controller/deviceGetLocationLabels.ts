import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { deviceProcedure } from '@/lib/trpc/procedures';

import type { LocationLabelData } from '../utils/generateLocationLabelZpl';
import { generateBatchLocationLabelsZpl } from '../utils/generateLocationLabelZpl';

/**
 * Get location labels for printing - device authenticated version
 *
 * This endpoint is for warehouse devices (TC27) that authenticate via device token
 * instead of user sessions.
 */
const deviceGetLocationLabels = deviceProcedure
  .input(
    z.object({
      deviceToken: z.string(),
      locationIds: z.array(z.string().uuid()).optional(),
      locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']).optional(),
    }),
  )
  .query(async ({ input }) => {
    const conditions = [eq(wmsLocations.isActive, true)];

    if (input.locationIds?.length) {
      conditions.push(inArray(wmsLocations.id, input.locationIds));
    }

    if (input.locationType) {
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

    // Generate ZPL for all labels with QR codes
    const labelData: LocationLabelData[] = locations.map((loc) => ({
      barcode: loc.barcode,
      locationCode: loc.locationCode,
      aisle: loc.aisle,
      bay: loc.bay,
      level: loc.level,
      locationType: loc.locationType,
      requiresForklift: loc.requiresForklift,
    }));

    const zpl = generateBatchLocationLabelsZpl(labelData);

    return {
      locations,
      totalLabels: locations.length,
      zpl,
    };
  });

export default deviceGetLocationLabels;

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { deviceProcedure, validateDeviceToken } from '@/lib/trpc/procedures';

import type { BayTotemData } from '../utils/generateBayTotemZpl';
import { generateBatchBayTotemsZpl } from '../utils/generateBayTotemZpl';

/**
 * Get bay totems for printing - device authenticated version
 *
 * This endpoint is for warehouse devices (TC27) that authenticate via device token
 * instead of user sessions.
 *
 * Returns one totem per bay, each containing all levels for that bay.
 * Levels are sorted from highest (top) to lowest (bottom) for the strip layout.
 */
const deviceGetBayTotems = deviceProcedure
  .input(
    z.object({
      deviceToken: z.string(),
      aisle: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    // Validate device token
    validateDeviceToken(input.deviceToken);

    // Only get rack locations (not receiving/shipping)
    const conditions = [
      eq(wmsLocations.isActive, true),
      eq(wmsLocations.locationType, 'rack'),
    ];

    if (input.aisle) {
      conditions.push(eq(wmsLocations.aisle, input.aisle.toUpperCase()));
    }

    const locations = await db
      .select({
        id: wmsLocations.id,
        locationCode: wmsLocations.locationCode,
        barcode: wmsLocations.barcode,
        aisle: wmsLocations.aisle,
        bay: wmsLocations.bay,
        level: wmsLocations.level,
        requiresForklift: wmsLocations.requiresForklift,
      })
      .from(wmsLocations)
      .where(and(...conditions))
      .orderBy(wmsLocations.aisle, wmsLocations.bay, wmsLocations.level);

    // Group by aisle+bay
    const bayMap = new Map<string, BayTotemData>();

    for (const loc of locations) {
      const bayKey = `${loc.aisle}-${loc.bay}`;

      if (!bayMap.has(bayKey)) {
        bayMap.set(bayKey, {
          aisle: loc.aisle,
          bay: loc.bay,
          levels: [],
        });
      }

      bayMap.get(bayKey)!.levels.push({
        level: loc.level,
        barcode: loc.barcode,
        requiresForklift: loc.requiresForklift,
      });
    }

    // Sort levels within each bay (highest first for top-to-bottom strip)
    const totems: BayTotemData[] = [];
    for (const totem of bayMap.values()) {
      totem.levels.sort((a, b) => {
        const aNum = parseInt(a.level, 10);
        const bNum = parseInt(b.level, 10);
        return bNum - aNum; // Descending (highest level first)
      });
      totems.push(totem);
    }

    // Sort totems by aisle then bay
    totems.sort((a, b) => {
      if (a.aisle !== b.aisle) return a.aisle.localeCompare(b.aisle);
      return a.bay.localeCompare(b.bay);
    });

    // Generate ZPL for all totems
    const zpl = generateBatchBayTotemsZpl(totems);

    return {
      totems,
      totalTotems: totems.length,
      zpl,
    };
  });

export default deviceGetBayTotems;

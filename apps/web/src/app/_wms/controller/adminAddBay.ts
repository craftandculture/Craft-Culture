import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { addBaySchema } from '../schemas/baySchema';
import generateLocationBarcode from '../utils/generateLocationBarcode';
import generateLocationCode from '../utils/generateLocationCode';

/**
 * Add a new bay with all its levels
 *
 * Creates all location records for the specified bay.
 * Useful for adding a single bay when expanding warehouse layout.
 *
 * @example
 *   await trpcClient.wms.admin.locations.addBay.mutate({
 *     aisle: 'A',
 *     bay: '05',
 *     levels: ['00', '01', '02', '03'],
 *     forkliftFromLevel: '01'
 *   });
 */
const adminAddBay = adminProcedure.input(addBaySchema).mutation(async ({ input }) => {
  try {
    const locations: Array<{
      locationCode: string;
      aisle: string;
      bay: string;
      level: string;
      locationType: 'rack';
      requiresForklift: boolean;
      barcode: string;
    }> = [];

    for (const level of input.levels) {
      const locationCode = generateLocationCode(input.aisle, input.bay, level);
      const barcode = generateLocationBarcode(input.aisle, input.bay, level);

      const requiresForklift = input.forkliftFromLevel ? level >= input.forkliftFromLevel : false;

      locations.push({
        locationCode,
        aisle: input.aisle.toUpperCase(),
        bay: input.bay,
        level,
        locationType: 'rack',
        requiresForklift,
        barcode,
      });
    }

    const inserted = await db
      .insert(wmsLocations)
      .values(locations)
      .onConflictDoNothing()
      .returning();

    return {
      created: inserted.length,
      total: locations.length,
      skipped: locations.length - inserted.length,
      locations: inserted,
    };
  } catch (error) {
    logger.error('Error adding bay:', error);

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to add bay. Please try again.',
    });
  }
});

export default adminAddBay;

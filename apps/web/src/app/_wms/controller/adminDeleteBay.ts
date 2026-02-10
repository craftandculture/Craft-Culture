import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { deleteBaySchema } from '../schemas/baySchema';

/**
 * Delete a bay and all its locations
 *
 * Removes all location records for the specified bay.
 * Will fail if any locations contain stock.
 *
 * @example
 *   await trpcClient.wms.admin.locations.deleteBay.mutate({
 *     aisle: 'A',
 *     bay: '05',
 *   });
 */
const adminDeleteBay = adminProcedure.input(deleteBaySchema).mutation(async ({ input }) => {
  try {
    const aisle = input.aisle.toUpperCase();
    const bay = input.bay;

    // First, get all locations for this bay
    const locations = await db
      .select({ id: wmsLocations.id })
      .from(wmsLocations)
      .where(and(eq(wmsLocations.aisle, aisle), eq(wmsLocations.bay, bay)));

    if (locations.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Bay ${aisle}-${bay} not found`,
      });
    }

    const locationIds = locations.map((l) => l.id);

    // Check if any stock exists in these locations
    const stockInBay = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wmsStock)
      .where(
        and(
          sql`${wmsStock.locationId} = ANY(${locationIds})`,
          sql`${wmsStock.quantityCases} > 0`,
        ),
      );

    const stockCount = stockInBay[0]?.count ?? 0;
    if (stockCount > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Cannot delete bay ${aisle}-${bay}: ${stockCount} stock record(s) exist. Move or remove stock first.`,
      });
    }

    // Delete all locations for this bay
    const deleted = await db
      .delete(wmsLocations)
      .where(and(eq(wmsLocations.aisle, aisle), eq(wmsLocations.bay, bay)))
      .returning({ id: wmsLocations.id });

    return {
      deleted: deleted.length,
      aisle,
      bay,
    };
  } catch (error) {
    logger.error('Error deleting bay:', error);

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to delete bay. Please try again.',
    });
  }
});

export default adminDeleteBay;

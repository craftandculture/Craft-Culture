import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Update bay settings - storage method and forklift requirements
 *
 * Updates all locations in a bay with the specified settings.
 *
 * @example
 *   await trpcClient.wms.admin.locations.updateBay.mutate({
 *     aisle: 'A',
 *     bay: '01',
 *     storageMethod: 'pallet',
 *     forkliftFromLevel: '01'
 *   });
 */
const adminUpdateBay = adminProcedure
  .input(
    z.object({
      aisle: z.string().min(1).max(10),
      bay: z.string().min(1).max(10),
      storageMethod: z.enum(['shelf', 'pallet', 'mixed']).optional(),
      forkliftFromLevel: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    try {
      const aisle = input.aisle.toUpperCase();
      const bay = input.bay;

      // Get all locations for this bay
      const locations = await db
        .select({ id: wmsLocations.id, level: wmsLocations.level })
        .from(wmsLocations)
        .where(and(eq(wmsLocations.aisle, aisle), eq(wmsLocations.bay, bay)));

      if (locations.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Bay ${aisle}-${bay} not found`,
        });
      }

      let updatedCount = 0;

      // Update each location
      for (const location of locations) {
        const updates: {
          storageMethod?: 'shelf' | 'pallet' | 'mixed';
          requiresForklift?: boolean;
        } = {};

        if (input.storageMethod) {
          updates.storageMethod = input.storageMethod;
        }

        if (input.forkliftFromLevel !== undefined) {
          // Set forklift required based on level comparison
          updates.requiresForklift = location.level >= input.forkliftFromLevel;
        }

        if (Object.keys(updates).length > 0) {
          await db
            .update(wmsLocations)
            .set(updates)
            .where(eq(wmsLocations.id, location.id));
          updatedCount++;
        }
      }

      return {
        updated: updatedCount,
        aisle,
        bay,
      };
    } catch (error) {
      logger.error('Error updating bay:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update bay. Please try again.',
      });
    }
  });

export default adminUpdateBay;

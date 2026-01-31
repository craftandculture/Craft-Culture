import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { batchCreateLocationsSchema } from '../schemas/locationSchema';
import generateLocationBarcode from '../utils/generateLocationBarcode';
import generateLocationCode from '../utils/generateLocationCode';

/**
 * Batch create warehouse locations
 *
 * Creates all combinations of aisles x bays x levels.
 * Useful for initial warehouse setup.
 *
 * @example
 *   await trpcClient.wms.admin.locations.batchCreate.mutate({
 *     aisles: ["A", "B"],
 *     bays: ["01", "02", "03"],
 *     levels: ["00", "01", "02", "03"],
 *     locationType: "rack",
 *     forkliftFromLevel: "01"
 *   });
 */
const adminBatchCreateLocations = adminProcedure
  .input(batchCreateLocationsSchema)
  .mutation(async ({ input }) => {
    try {
      const locations: Array<{
        locationCode: string;
        aisle: string;
        bay: string;
        level: string;
        locationType: 'rack' | 'floor' | 'receiving' | 'shipping';
        requiresForklift: boolean;
        barcode: string;
      }> = [];

      for (const aisle of input.aisles) {
        for (const bay of input.bays) {
          for (const level of input.levels) {
            const locationCode = generateLocationCode(aisle, bay, level);
            const barcode = generateLocationBarcode(aisle, bay, level);

            // Determine if forklift is required based on level
            const requiresForklift = input.forkliftFromLevel
              ? level >= input.forkliftFromLevel
              : false;

            locations.push({
              locationCode,
              aisle: aisle.toUpperCase(),
              bay,
              level,
              locationType: input.locationType,
              requiresForklift,
              barcode,
            });
          }
        }
      }

      if (locations.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No locations to create',
        });
      }

      // Insert in batches to avoid hitting limits
      const batchSize = 100;
      const createdLocations = [];

      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        const inserted = await db
          .insert(wmsLocations)
          .values(batch)
          .onConflictDoNothing()
          .returning();

        createdLocations.push(...inserted);
      }

      return {
        created: createdLocations.length,
        total: locations.length,
        skipped: locations.length - createdLocations.length,
        locations: createdLocations,
      };
    } catch (error) {
      logger.error('Error batch creating locations:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create locations. Please try again.',
      });
    }
  });

export default adminBatchCreateLocations;

import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { createLocationSchema } from '../schemas/locationSchema';
import generateLocationBarcode from '../utils/generateLocationBarcode';
import generateLocationCode from '../utils/generateLocationCode';

/**
 * Create a new warehouse location
 *
 * @example
 *   await trpcClient.wms.admin.locations.create.mutate({
 *     aisle: "A",
 *     bay: "01",
 *     level: "02",
 *     locationType: "rack",
 *     requiresForklift: true
 *   });
 */
const adminCreateLocation = adminProcedure
  .input(createLocationSchema)
  .mutation(async ({ input }) => {
    try {
      const locationCode = generateLocationCode(input.aisle, input.bay, input.level);
      const barcode = generateLocationBarcode(input.aisle, input.bay, input.level);

      const [location] = await db
        .insert(wmsLocations)
        .values({
          locationCode,
          aisle: input.aisle.toUpperCase(),
          bay: input.bay,
          level: input.level,
          locationType: input.locationType,
          capacityCases: input.capacityCases,
          requiresForklift: input.requiresForklift,
          barcode,
          notes: input.notes,
        })
        .returning();

      if (!location) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create location',
        });
      }

      return location;
    } catch (error) {
      logger.error('Error creating location:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      // Check for unique constraint violation
      if (
        error instanceof Error &&
        error.message.includes('unique constraint')
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A location with this code already exists',
        });
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create location. Please try again.',
      });
    }
  });

export default adminCreateLocation;

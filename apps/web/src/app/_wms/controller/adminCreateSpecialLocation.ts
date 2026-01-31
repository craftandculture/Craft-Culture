import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Create a special warehouse location (RECEIVING, SHIPPING, etc.)
 *
 * @example
 *   await trpcClient.wms.admin.locations.createSpecial.mutate({
 *     name: "RECEIVING",
 *     locationType: "receiving"
 *   });
 */
const adminCreateSpecialLocation = adminProcedure
  .input(
    z.object({
      name: z.string().min(1).max(50),
      locationType: z.enum(['receiving', 'shipping', 'floor']),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    try {
      const locationCode = input.name.toUpperCase();
      const barcode = `LOC-${locationCode}`;

      const [location] = await db
        .insert(wmsLocations)
        .values({
          locationCode,
          aisle: '-',
          bay: '-',
          level: '-',
          locationType: input.locationType,
          requiresForklift: false,
          barcode,
          notes: input.notes,
        })
        .returning();

      if (!location) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create special location',
        });
      }

      return location;
    } catch (error) {
      logger.error('Error creating special location:', error);

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
          message: 'A location with this name already exists',
        });
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create special location. Please try again.',
      });
    }
  });

export default adminCreateSpecialLocation;

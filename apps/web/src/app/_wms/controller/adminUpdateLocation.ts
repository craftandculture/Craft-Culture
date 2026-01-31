import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { updateLocationSchema } from '../schemas/locationSchema';

/**
 * Update an existing warehouse location
 *
 * @example
 *   await trpcClient.wms.admin.locations.update.mutate({
 *     id: "uuid",
 *     capacityCases: 50,
 *     requiresForklift: true
 *   });
 */
const adminUpdateLocation = adminProcedure
  .input(updateLocationSchema)
  .mutation(async ({ input }) => {
    try {
      const { id, ...updates } = input;

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined),
      );

      if (Object.keys(cleanUpdates).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No updates provided',
        });
      }

      const [location] = await db
        .update(wmsLocations)
        .set({
          ...cleanUpdates,
          updatedAt: new Date(),
        })
        .where(eq(wmsLocations.id, id))
        .returning();

      if (!location) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Location not found',
        });
      }

      return location;
    } catch (error) {
      logger.error('Error updating location:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update location. Please try again.',
      });
    }
  });

export default adminUpdateLocation;

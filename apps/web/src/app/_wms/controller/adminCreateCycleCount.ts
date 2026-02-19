import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCycleCountItems,
  wmsCycleCounts,
  wmsLocations,
  wmsStock,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createCycleCountSchema } from '../schemas/cycleCountSchema';
import generateCountNumber from '../utils/generateCountNumber';

/**
 * Create a new cycle count for a specific location
 *
 * Snapshots the current expected inventory at the location into
 * cycle count items for the operator to count against.
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.create.mutate({
 *     locationId: "uuid",
 *   });
 */
const adminCreateCycleCount = adminProcedure
  .input(createCycleCountSchema)
  .mutation(async ({ input, ctx }) => {
    const { locationId, notes } = input;

    // Validate location exists
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, locationId));

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    // Get current stock at this location
    const stock = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        quantityCases: wmsStock.quantityCases,
      })
      .from(wmsStock)
      .where(eq(wmsStock.locationId, locationId))
      .orderBy(wmsStock.productName);

    const totalExpected = stock.reduce((sum, s) => sum + s.quantityCases, 0);

    // Generate count number
    const countNumber = await generateCountNumber();

    // Create cycle count header
    const [cycleCount] = await db
      .insert(wmsCycleCounts)
      .values({
        countNumber,
        locationId,
        status: 'pending',
        expectedItems: totalExpected,
        countedItems: 0,
        discrepancyCount: 0,
        createdBy: ctx.user.id,
        notes,
      })
      .returning();

    // Snapshot stock into cycle count items
    if (stock.length > 0) {
      await db.insert(wmsCycleCountItems).values(
        stock.map((s) => ({
          cycleCountId: cycleCount!.id,
          stockId: s.id,
          locationId,
          lwin18: s.lwin18,
          productName: s.productName,
          expectedQuantity: s.quantityCases,
        })),
      );
    }

    return {
      success: true,
      cycleCount: {
        id: cycleCount!.id,
        countNumber,
        locationCode: location.locationCode,
        expectedItems: totalExpected,
        itemCount: stock.length,
      },
    };
  });

export default adminCreateCycleCount;

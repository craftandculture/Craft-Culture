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

import { getCycleCountSchema } from '../schemas/cycleCountSchema';

/**
 * Get a single cycle count with all items and location info
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.getOne.query({
 *     countId: "uuid",
 *   });
 */
const adminGetCycleCount = adminProcedure
  .input(getCycleCountSchema)
  .query(async ({ input }) => {
    const { countId } = input;

    const [cycleCount] = await db
      .select({
        id: wmsCycleCounts.id,
        countNumber: wmsCycleCounts.countNumber,
        locationId: wmsCycleCounts.locationId,
        locationCode: wmsLocations.locationCode,
        locationType: wmsLocations.locationType,
        status: wmsCycleCounts.status,
        expectedItems: wmsCycleCounts.expectedItems,
        countedItems: wmsCycleCounts.countedItems,
        discrepancyCount: wmsCycleCounts.discrepancyCount,
        createdAt: wmsCycleCounts.createdAt,
        completedAt: wmsCycleCounts.completedAt,
        notes: wmsCycleCounts.notes,
      })
      .from(wmsCycleCounts)
      .leftJoin(wmsLocations, eq(wmsCycleCounts.locationId, wmsLocations.id))
      .where(eq(wmsCycleCounts.id, countId));

    if (!cycleCount) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Cycle count not found',
      });
    }

    const items = await db
      .select({
        id: wmsCycleCountItems.id,
        stockId: wmsCycleCountItems.stockId,
        lwin18: wmsCycleCountItems.lwin18,
        productName: wmsCycleCountItems.productName,
        expectedQuantity: wmsCycleCountItems.expectedQuantity,
        countedQuantity: wmsCycleCountItems.countedQuantity,
        discrepancy: wmsCycleCountItems.discrepancy,
        notes: wmsCycleCountItems.notes,
        countedAt: wmsCycleCountItems.countedAt,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
      })
      .from(wmsCycleCountItems)
      .leftJoin(wmsStock, eq(wmsCycleCountItems.stockId, wmsStock.id))
      .where(eq(wmsCycleCountItems.cycleCountId, countId))
      .orderBy(wmsCycleCountItems.productName);

    return {
      ...cycleCount,
      items,
    };
  });

export default adminGetCycleCount;

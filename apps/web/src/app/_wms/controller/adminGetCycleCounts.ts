import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCycleCounts, wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getCycleCountsSchema } from '../schemas/cycleCountSchema';

/**
 * List all cycle counts with optional status filter
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.getMany.query({
 *     status: 'completed',
 *   });
 */
const adminGetCycleCounts = adminProcedure
  .input(getCycleCountsSchema)
  .query(async ({ input }) => {
    const { status, limit, offset } = input;

    const conditions = status
      ? eq(wmsCycleCounts.status, status)
      : undefined;

    const counts = await db
      .select({
        id: wmsCycleCounts.id,
        countNumber: wmsCycleCounts.countNumber,
        locationId: wmsCycleCounts.locationId,
        locationCode: wmsLocations.locationCode,
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
      .where(conditions)
      .orderBy(desc(wmsCycleCounts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wmsCycleCounts)
      .where(conditions);

    return {
      counts,
      total: totalResult?.count ?? 0,
    };
  });

export default adminGetCycleCounts;

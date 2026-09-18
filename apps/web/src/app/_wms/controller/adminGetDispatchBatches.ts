import { and, count, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsDispatchBatches } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getDispatchBatchesSchema } from '../schemas/dispatchBatchSchema';

/**
 * Get dispatch batches with filtering and pagination
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.getMany.query({});
 *   await trpcClient.wms.admin.dispatch.getMany.query({ status: 'draft' });
 */
const adminGetDispatchBatches = wmsOperatorProcedure
  .input(getDispatchBatchesSchema)
  .query(async ({ input }) => {
    const { status, distributorId, limit, offset } = input;

    // Build where conditions
    const conditions = [];
    if (status) conditions.push(eq(wmsDispatchBatches.status, status));
    if (distributorId) conditions.push(eq(wmsDispatchBatches.distributorId, distributorId));
    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

    // Get batches with dispatcher info
    const batches = await db
      .select({
        id: wmsDispatchBatches.id,
        batchNumber: wmsDispatchBatches.batchNumber,
        status: wmsDispatchBatches.status,
        distributorId: wmsDispatchBatches.distributorId,
        distributorName: wmsDispatchBatches.distributorName,
        orderCount: wmsDispatchBatches.orderCount,
        totalCases: wmsDispatchBatches.totalCases,
        palletCount: wmsDispatchBatches.palletCount,
        dispatchedAt: wmsDispatchBatches.dispatchedAt,
        dispatchedByName: users.name,
        deliveredAt: wmsDispatchBatches.deliveredAt,
        notes: wmsDispatchBatches.notes,
        createdAt: wmsDispatchBatches.createdAt,
      })
      .from(wmsDispatchBatches)
      .leftJoin(users, eq(wmsDispatchBatches.dispatchedBy, users.id))
      .where(whereConditions)
      /*
        When the batch shipped, not when its row was written. These are the
        same for a batch dispatched live, but not for one recorded after the
        fact — a backlog entered today for goods that left in May belongs in
        May, otherwise the list opens on the oldest shipments.
      */
      .orderBy(
        sql`COALESCE(${wmsDispatchBatches.dispatchedAt}, ${wmsDispatchBatches.createdAt}) DESC`,
      )
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(wmsDispatchBatches)
      .where(whereConditions);

    // Get summary by status
    const statusSummary = await db
      .select({
        status: wmsDispatchBatches.status,
        count: count(),
      })
      .from(wmsDispatchBatches)
      .groupBy(wmsDispatchBatches.status);

    const countOf = (value: string) =>
      statusSummary.find((s) => s.status === value)?.count ?? 0;

    const draftCount = countOf('draft');
    const pickingCount = countOf('picking');
    const stagedCount = countOf('staged');
    const dispatchedCount = countOf('dispatched');
    const deliveredCount = countOf('delivered');

    /*
      Every batch, whatever its status. The page was showing the FILTERED count
      under a "Total Batches" heading, so opening on a status with nothing in it
      reported a total of zero while a dozen batches sat behind the other tabs.
    */
    const totalCount = statusSummary.reduce((sum, s) => sum + s.count, 0);

    return {
      batches,
      pagination: {
        total: countResult?.count ?? 0,
        limit,
        offset,
      },
      summary: {
        draftCount,
        pickingCount,
        stagedCount,
        dispatchedCount,
        deliveredCount,
        // Batches still needing someone to act on them.
        openCount: draftCount + pickingCount + stagedCount,
        totalCount,
        byStatus: statusSummary,
      },
    };
  });

export default adminGetDispatchBatches;

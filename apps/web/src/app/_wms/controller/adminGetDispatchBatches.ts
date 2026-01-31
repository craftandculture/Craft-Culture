import { and, count, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsDispatchBatches } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getDispatchBatchesSchema } from '../schemas/dispatchBatchSchema';

/**
 * Get dispatch batches with filtering and pagination
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.getMany.query({});
 *   await trpcClient.wms.admin.dispatch.getMany.query({ status: 'draft' });
 */
const adminGetDispatchBatches = adminProcedure
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
      .orderBy(desc(wmsDispatchBatches.createdAt))
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

    const draftCount = statusSummary.find((s) => s.status === 'draft')?.count ?? 0;
    const pickingCount = statusSummary.find((s) => s.status === 'picking')?.count ?? 0;
    const stagedCount = statusSummary.find((s) => s.status === 'staged')?.count ?? 0;

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
        byStatus: statusSummary,
      },
    };
  });

export default adminGetDispatchBatches;

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners, wmsDispatchBatches } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createDispatchBatchSchema } from '../schemas/dispatchBatchSchema';
import generateBatchNumber from '../utils/generateBatchNumber';

/**
 * Create a new dispatch batch for a distributor
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.create.mutate({
 *     distributorId: "uuid"
 *   });
 */
const adminCreateDispatchBatch = adminProcedure
  .input(createDispatchBatchSchema)
  .mutation(async ({ input }) => {
    const { distributorId } = input;

    // Get distributor info
    const [distributor] = await db
      .select({
        id: partners.id,
        name: partners.companyName,
        type: partners.type,
      })
      .from(partners)
      .where(eq(partners.id, distributorId));

    if (!distributor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Distributor not found',
      });
    }

    // Generate batch number
    const batchNumber = await generateBatchNumber();

    // Create batch
    const [batch] = await db
      .insert(wmsDispatchBatches)
      .values({
        batchNumber,
        distributorId,
        distributorName: distributor.name,
        status: 'draft',
        orderCount: 0,
        totalCases: 0,
      })
      .returning();

    return {
      success: true,
      batch,
      message: `Batch ${batchNumber} created for ${distributor.name}`,
    };
  });

export default adminCreateDispatchBatch;

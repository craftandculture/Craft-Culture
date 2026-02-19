import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCycleCounts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { startCycleCountSchema } from '../schemas/cycleCountSchema';

/**
 * Start a cycle count — transitions status from pending to in_progress
 *
 * @example
 *   await trpcClient.wms.admin.cycleCounts.start.mutate({
 *     countId: "uuid",
 *   });
 */
const adminStartCycleCount = adminProcedure
  .input(startCycleCountSchema)
  .mutation(async ({ input }) => {
    const { countId } = input;

    const [cycleCount] = await db
      .select()
      .from(wmsCycleCounts)
      .where(eq(wmsCycleCounts.id, countId));

    if (!cycleCount) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Cycle count not found',
      });
    }

    if (cycleCount.status !== 'pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot start a count with status "${cycleCount.status}"`,
      });
    }

    await db
      .update(wmsCycleCounts)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(wmsCycleCounts.id, countId));

    return { success: true };
  });

export default adminStartCycleCount;

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarAllocations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * The team stops taking interest in an allocation
 *
 * Members can no longer ask for it; shares already given out still stand and
 * can still be confirmed.
 *
 * @example
 *   await trpcClient.cellarSourcing.admin.closeAllocation.mutate({ allocationId });
 */
const adminCloseAllocation = staffAdminProcedure
  .input(z.object({ allocationId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const [row] = await db
      .update(cellarAllocations)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(
        and(
          eq(cellarAllocations.id, input.allocationId),
          eq(cellarAllocations.status, 'open'),
        ),
      )
      .returning({ id: cellarAllocations.id });

    if (!row) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This offer is already closed.',
      });
    }

    return { id: row.id };
  });

export default adminCloseAllocation;

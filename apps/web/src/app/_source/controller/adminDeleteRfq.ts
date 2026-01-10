import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getOneRfqSchema from '../schemas/getOneRfqSchema';

/**
 * Delete a SOURCE RFQ (cascade deletes items, partners, quotes)
 *
 * @example
 *   await trpcClient.source.admin.delete.mutate({
 *     rfqId: "uuid-here"
 *   });
 */
const adminDeleteRfq = adminProcedure
  .input(getOneRfqSchema)
  .mutation(async ({ input }) => {
    const { rfqId } = input;

    // Verify RFQ exists
    const [existing] = await db
      .select({ id: sourceRfqs.id, status: sourceRfqs.status })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Prevent deletion of RFQs that are in progress (must cancel first)
    const nonDeletableStatuses = ['sent', 'collecting', 'comparing', 'selecting', 'finalized', 'po_generated', 'quote_generated'];
    if (nonDeletableStatuses.includes(existing.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete RFQ that is in progress. Cancel it first.',
      });
    }

    await db.delete(sourceRfqs).where(eq(sourceRfqs.id, rfqId));

    return { success: true };
  });

export default adminDeleteRfq;

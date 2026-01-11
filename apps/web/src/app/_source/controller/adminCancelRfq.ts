import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getOneRfqSchema from '../schemas/getOneRfqSchema';

/**
 * Cancel a SOURCE RFQ
 *
 * Can cancel RFQs that have been sent to partners. Use delete for draft RFQs.
 *
 * @example
 *   await trpcClient.source.admin.cancel.mutate({
 *     rfqId: "uuid-here"
 *   });
 */
const adminCancelRfq = adminProcedure
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

    // Can only cancel RFQs that are in progress
    const cancellableStatuses = [
      'sent',
      'collecting',
      'comparing',
      'selecting',
      'client_review',
      'awaiting_confirmation',
      'confirmed',
      'quote_generated',
    ];

    if (!cancellableStatuses.includes(existing.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          existing.status === 'cancelled'
            ? 'RFQ is already cancelled'
            : existing.status === 'closed'
              ? 'Cannot cancel a closed RFQ'
              : 'Use delete for draft RFQs that have not been sent',
      });
    }

    await db
      .update(sourceRfqs)
      .set({ status: 'cancelled' })
      .where(eq(sourceRfqs.id, rfqId));

    return { success: true };
  });

export default adminCancelRfq;

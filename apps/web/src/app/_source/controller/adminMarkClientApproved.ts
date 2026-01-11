import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const markClientApprovedSchema = z.object({
  rfqId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Mark an RFQ's selected quotes as approved by the client
 *
 * This transitions the RFQ from 'client_review' to 'awaiting_confirmation'
 * and prepares for requesting partner confirmations.
 *
 * @example
 *   await trpcClient.source.admin.markClientApproved.mutate({
 *     rfqId: "uuid-here",
 *     notes: "Client approved via email on Jan 10"
 *   });
 */
const adminMarkClientApproved = adminProcedure
  .input(markClientApprovedSchema)
  .mutation(async ({ input, ctx }) => {
    const { rfqId, notes } = input;
    const userId = ctx.user.id;

    // Verify RFQ exists and is in correct status
    const [existing] = await db
      .select({
        id: sourceRfqs.id,
        status: sourceRfqs.status,
        rfqNumber: sourceRfqs.rfqNumber,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Can only mark as client approved from 'client_review' status
    if (existing.status !== 'client_review') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `RFQ must be in 'client_review' status to mark as client approved. Current status: ${existing.status}`,
      });
    }

    // Update RFQ with client approval
    const [updated] = await db
      .update(sourceRfqs)
      .set({
        status: 'awaiting_confirmation',
        clientApprovedAt: new Date(),
        clientApprovedBy: userId,
        clientApprovalNotes: notes,
      })
      .where(eq(sourceRfqs.id, rfqId))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update RFQ',
      });
    }

    return {
      success: true,
      rfqId: updated.id,
      rfqNumber: existing.rfqNumber,
      status: updated.status,
      clientApprovedAt: updated.clientApprovedAt,
    };
  });

export default adminMarkClientApproved;

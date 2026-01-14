import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const reopenSchema = z.object({
  rfqId: z.string().uuid(),
});

/**
 * Reopen an RFQ for changes after quote has been generated
 *
 * Allows admins to go back and modify quote selections even after
 * the quote PDF has been exported. This is useful when clients
 * request changes or when supplier availability changes.
 *
 * @example
 *   await trpcClient.source.admin.rfq.reopenForChanges.mutate({
 *     rfqId: "uuid",
 *   });
 */
const adminReopenRfqForChanges = adminProcedure
  .input(reopenSchema)
  .mutation(async ({ input }) => {
    try {
      // Get the current RFQ
      const [rfq] = await db
        .select({
          id: sourceRfqs.id,
          status: sourceRfqs.status,
          rfqNumber: sourceRfqs.rfqNumber,
        })
        .from(sourceRfqs)
        .where(eq(sourceRfqs.id, input.rfqId))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'RFQ not found',
        });
      }

      // Only allow reopening from finalized states
      const reopenableStatuses = [
        'quote_generated',
        'client_review',
        'awaiting_confirmation',
      ];

      if (!reopenableStatuses.includes(rfq.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot reopen RFQ in status "${rfq.status}". Only finalized quotes can be reopened for changes.`,
        });
      }

      // Update status back to 'selecting' to allow changes
      await db
        .update(sourceRfqs)
        .set({
          status: 'selecting',
          updatedAt: new Date(),
        })
        .where(eq(sourceRfqs.id, input.rfqId));

      logger.dev(`RFQ ${rfq.rfqNumber} reopened for changes`);

      return {
        success: true,
        message: 'RFQ reopened for changes. You can now modify selections and re-export the quote.',
        previousStatus: rfq.status,
      };
    } catch (error) {
      logger.error('Error reopening RFQ for changes:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reopen RFQ. Please try again.',
      });
    }
  });

export default adminReopenRfqForChanges;

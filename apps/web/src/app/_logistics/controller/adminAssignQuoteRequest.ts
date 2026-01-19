import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Assign a quote request to a user (or self)
 *
 * Updates the request status to 'in_progress' and records the assignment.
 */
const adminAssignQuoteRequest = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      assignedTo: z.string().uuid().optional(), // If not provided, assigns to self
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { requestId, assignedTo } = input;
    const assigneeId = assignedTo || ctx.user.id;

    // Get current request
    const [existing] = await db
      .select()
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot assign a completed or cancelled request',
      });
    }

    const [updated] = await db
      .update(logisticsQuoteRequests)
      .set({
        assignedTo: assigneeId,
        assignedAt: new Date(),
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(logisticsQuoteRequests.id, requestId))
      .returning();

    logger.info('Assigned quote request', {
      requestId,
      assignedTo: assigneeId,
      assignedBy: ctx.user.id,
    });

    return updated;
  });

export default adminAssignQuoteRequest;

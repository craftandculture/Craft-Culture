import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';
import tryCatch from '@/utils/tryCatch';

const agentTaskIds = {
  scout: 'scout-daily',
  concierge: 'concierge-daily',
  storyteller: 'storyteller-weekly',
} as const;

/**
 * Manually trigger an agent job via the Trigger.dev REST API
 */
const triggerAgent = adminProcedure
  .input(
    z.object({
      agentId: z.enum(['scout', 'concierge', 'storyteller']),
    }),
  )
  .mutation(async ({ input }) => {
    const taskId = agentTaskIds[input.agentId];
    const secretKey = process.env.TRIGGER_SECRET_KEY;

    if (!secretKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'TRIGGER_SECRET_KEY is not configured',
      });
    }

    const [response, fetchError] = await tryCatch(
      fetch(`https://api.trigger.dev/api/v1/tasks/${taskId}/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload: {} }),
      }),
    );

    if (fetchError) {
      logger.error('Failed to trigger agent', {
        agentId: input.agentId,
        taskId,
        error: fetchError.message,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to trigger ${input.agentId} agent`,
      });
    }

    const [body, parseError] = await tryCatch(response.json() as Promise<Record<string, unknown>>);

    if (!response.ok || parseError) {
      logger.error('Trigger.dev API error', {
        agentId: input.agentId,
        taskId,
        status: response.status,
        body: body ?? parseError?.message,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Trigger.dev returned ${response.status} for ${input.agentId}`,
      });
    }

    const runId = (body as { id?: string }).id ?? 'unknown';

    logger.info('Agent triggered manually via REST API', {
      agentId: input.agentId,
      taskId,
      runId,
    });

    return { success: true, runId };
  });

export default triggerAgent;

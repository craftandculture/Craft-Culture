import { tasks } from '@trigger.dev/sdk/v3';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const agentTaskIds = {
  scout: 'scout-daily',
  concierge: 'concierge-daily',
  storyteller: 'storyteller-weekly',
} as const;

/**
 * Manually trigger an agent job via Trigger.dev
 */
const triggerAgent = adminProcedure
  .input(
    z.object({
      agentId: z.enum(['scout', 'concierge', 'storyteller']),
    }),
  )
  .mutation(async ({ input }) => {
    const taskId = agentTaskIds[input.agentId];

    try {
      const handle = await tasks.trigger(taskId, {});

      logger.info('Agent triggered manually', {
        agentId: input.agentId,
        taskId,
        runId: handle.id,
      });

      return { success: true, runId: handle.id };
    } catch (error) {
      logger.error('Failed to trigger agent', {
        agentId: input.agentId,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to trigger ${input.agentId} agent`,
      });
    }
  });

export default triggerAgent;

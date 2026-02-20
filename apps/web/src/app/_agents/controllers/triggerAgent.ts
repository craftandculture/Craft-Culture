import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import runAdvisor from '../lib/runAdvisor';
import runBuyer from '../lib/runBuyer';
import runConcierge from '../lib/runConcierge';
import runPricer from '../lib/runPricer';
import runScout from '../lib/runScout';
import runStoryteller from '../lib/runStoryteller';

const agentRunners = {
  scout: runScout,
  concierge: runConcierge,
  storyteller: runStoryteller,
  buyer: runBuyer,
  pricer: runPricer,
  advisor: runAdvisor,
} as const;

/**
 * Manually trigger an agent job — runs directly on the server
 */
const triggerAgent = adminProcedure
  .input(
    z.object({
      agentId: z.enum(['scout', 'concierge', 'storyteller', 'buyer', 'pricer', 'advisor']),
    }),
  )
  .mutation(async ({ input }) => {
    const runner = agentRunners[input.agentId];

    try {
      logger.info('Agent triggered manually', { agentId: input.agentId });
      const result = await runner();
      logger.info('Agent completed', { agentId: input.agentId, result });
      return { success: true, ...result };
    } catch (error) {
      logger.error('Agent failed', {
        agentId: input.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `${input.agentId} agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

export default triggerAgent;

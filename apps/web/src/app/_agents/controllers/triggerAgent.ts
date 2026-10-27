import { TRPCError } from '@trpc/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { agentRuns } from '@/database/schema';
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

/** A run younger than this still counts as in progress */
const RUNNING_WINDOW_MINUTES = 15;

/** Minimum gap between two manual runs of the same agent */
const COOLDOWN_MINUTES = 2;

/** Agents running from a manual trigger on this server instance */
const inFlight = new Set<string>();

/**
 * Manually trigger an agent job — runs directly on the server
 *
 * Each run spends model credits and may post to Slack, so a second click while
 * one is running (or straight after) is refused rather than run twice.
 */
const triggerAgent = adminProcedure
  .input(
    z.object({
      agentId: z.enum(['scout', 'concierge', 'storyteller', 'buyer', 'pricer', 'advisor']),
    }),
  )
  .mutation(async ({ input }) => {
    const runner = agentRunners[input.agentId];

    if (inFlight.has(input.agentId)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `The ${input.agentId} agent is already running.`,
      });
    }

    const [lastRun] = await db
      .select({
        status: agentRuns.status,
        isRecent: sql<boolean>`${agentRuns.startedAt} > NOW() - make_interval(mins => ${RUNNING_WINDOW_MINUTES})`,
        inCooldown: sql<boolean>`${agentRuns.startedAt} > NOW() - make_interval(mins => ${COOLDOWN_MINUTES})`,
      })
      .from(agentRuns)
      .where(eq(agentRuns.agentId, input.agentId))
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);

    if (lastRun?.status === 'running' && lastRun.isRecent) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `The ${input.agentId} agent is already running. Try again when it has finished.`,
      });
    }

    if (lastRun?.inCooldown) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `The ${input.agentId} agent ran in the last ${COOLDOWN_MINUTES} minutes. Try again shortly.`,
      });
    }

    inFlight.add(input.agentId);

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
    } finally {
      inFlight.delete(input.agentId);
    }
  });

export default triggerAgent;

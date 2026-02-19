import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { agentOutputs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get the latest output for each agent (or a specific agent)
 */
const getLatestBrief = adminProcedure
  .input(
    z.object({
      agentId: z.string().min(1).optional(),
    }),
  )
  .query(async ({ input }) => {
    const agentIds = input.agentId
      ? [input.agentId]
      : ['scout', 'concierge', 'storyteller'];

    const briefs = [];

    for (const id of agentIds) {
      const [latest] = await db
        .select()
        .from(agentOutputs)
        .where(eq(agentOutputs.agentId, id))
        .orderBy(desc(agentOutputs.createdAt))
        .limit(1);

      if (latest) {
        briefs.push(latest);
      }
    }

    return briefs;
  });

export default getLatestBrief;

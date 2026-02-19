import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { agentOutputs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getAgentOutputsSchema from '../schemas/getAgentOutputsSchema';

/**
 * Get paginated agent outputs for a specific agent
 */
const getAgentOutputs = adminProcedure
  .input(getAgentOutputsSchema)
  .query(async ({ input }) => {
    const { agentId, limit, offset } = input;

    const results = await db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, agentId))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  });

export default getAgentOutputs;

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { agentConfigs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all config key-value pairs for a specific agent
 */
const getAgentConfig = adminProcedure
  .input(
    z.object({
      agentId: z.string().min(1),
    }),
  )
  .query(async ({ input }) => {
    const configs = await db
      .select({
        configKey: agentConfigs.configKey,
        configValue: agentConfigs.configValue,
        updatedAt: agentConfigs.updatedAt,
      })
      .from(agentConfigs)
      .where(eq(agentConfigs.agentId, input.agentId));

    return configs;
  });

export default getAgentConfig;

import { z } from 'zod';

import db from '@/database/client';
import { agentConfigs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Upsert a config key-value pair for a specific agent
 */
const upsertAgentConfig = adminProcedure
  .input(
    z.object({
      agentId: z.string().min(1),
      configKey: z.string().min(1),
      configValue: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [result] = await db
      .insert(agentConfigs)
      .values({
        agentId: input.agentId,
        configKey: input.configKey,
        configValue: input.configValue,
        updatedBy: ctx.user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [agentConfigs.agentId, agentConfigs.configKey],
        set: {
          configValue: input.configValue,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        },
      })
      .returning({ id: agentConfigs.id });

    return { success: true, id: result?.id };
  });

export default upsertAgentConfig;

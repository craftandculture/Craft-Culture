import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskPeople } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

/**
 * Link team members to their Slack accounts, so #tasks can @mention them
 *
 * A Slack member ID is found in Slack under the person's profile, "Copy
 * member ID". Admins only.
 *
 * @example
 *   await trpcClient.teamTasks.setSlackIds.mutate([{ userId, slackMemberId: 'U07ABC123' }]);
 */
const setSlackIds = teamProcedure
  .input(z.array(z.object({ userId: z.string().uuid(), slackMemberId: z.string().trim().regex(/^$|^[UW][A-Z0-9]{6,}$/, 'A Slack member ID starts with U') })))
  .mutation(async ({ input, ctx }) => {
    if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only an admin can link Slack accounts' });

    for (const row of input) {
      await db
        .insert(teamTaskPeople)
        .values({ userId: row.userId, slackMemberId: row.slackMemberId || null })
        .onConflictDoUpdate({ target: teamTaskPeople.userId, set: { slackMemberId: row.slackMemberId || null } });
    }

    return { ok: true };
  });

export default setSlackIds;

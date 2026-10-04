import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { partnerTaskProcedure } from '@/lib/trpc/procedures';

/**
 * For the partner menu: how many jobs are shared with this partner, and how
 * many of the signed-in person's own parts are still open
 */
const partnerCount = partnerTaskProcedure.query(async ({ ctx }) => {
  const rows = await db
    .select({ taskId: teamTasks.id, ownerId: teamTaskParts.ownerId, done: teamTaskParts.done })
    .from(teamTasks)
    .leftJoin(teamTaskParts, eq(teamTaskParts.taskId, teamTasks.id))
    .where(and(eq(teamTasks.partnerId, ctx.partnerId), eq(teamTasks.status, 'open')));

  return {
    jobs: new Set(rows.map((r) => r.taskId)).size,
    mine: rows.filter((r) => r.ownerId === ctx.user.id && r.done === false).length,
  };
});

export default partnerCount;

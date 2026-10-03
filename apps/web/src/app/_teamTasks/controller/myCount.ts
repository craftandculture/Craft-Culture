import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import dubaiToday from '../utils/dubaiToday';

/**
 * The signed-in person's open parts, for the Tasks badge in the top bar
 *
 * Parts on jobs still waiting on someone are not counted: they cannot be
 * started yet. Overdue is judged on Dubai's date.
 *
 * @example
 *   const { open, overdue } = await trpcClient.teamTasks.myCount.query();
 */
const myCount = teamProcedure.query(async ({ ctx }) => {
  const rows = await db
    .select({ due: teamTaskParts.due, waitingOn: teamTasks.waitingOn })
    .from(teamTaskParts)
    .innerJoin(teamTasks, eq(teamTasks.id, teamTaskParts.taskId))
    .where(and(eq(teamTaskParts.ownerId, ctx.user.id), eq(teamTaskParts.done, false), eq(teamTasks.status, 'open')));

  const active = rows.filter((r) => !r.waitingOn);
  const today = dubaiToday();

  return {
    open: active.length,
    overdue: active.filter((r) => r.due && r.due < today).length,
  };
});

export default myCount;

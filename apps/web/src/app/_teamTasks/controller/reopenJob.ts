import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import announceTask from '../data/announceTask';
import logTaskEvent from '../data/logTaskEvent';

/**
 * Reopen a closed or cancelled job and tell #tasks
 *
 * Parts keep their ticks; untick or add a part to give it work again.
 *
 * @example
 *   await trpcClient.teamTasks.reopenJob.mutate({ taskId });
 */
const reopenJob = teamProcedure.input(z.object({ taskId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, input.taskId));

  if (!task || task.status === 'open') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This job is already open.' });
  }

  await db.update(teamTasks).set({ status: 'open', closedAt: null, closedBy: null }).where(eq(teamTasks.id, task.id));
  await logTaskEvent(task.id, ctx.user.id, `${ctx.user.name} reopened the job`);

  return { slack: await announceTask(task.id, 'reopened') };
});

export default reopenJob;

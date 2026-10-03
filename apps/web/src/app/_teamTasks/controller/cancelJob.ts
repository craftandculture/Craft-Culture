import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import announceTask from '../data/announceTask';
import logTaskEvent from '../data/logTaskEvent';

/**
 * Cancel a job that is no longer needed, and tell #tasks
 *
 * It moves to Done marked as cancelled, and can be reopened.
 *
 * @example
 *   await trpcClient.teamTasks.cancelJob.mutate({ taskId });
 */
const cancelJob = teamProcedure.input(z.object({ taskId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, input.taskId));

  if (!task || task.status !== 'open') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This job is not open.' });
  }

  await db.update(teamTasks).set({ status: 'cancelled', closedAt: new Date(), closedBy: ctx.user.id }).where(eq(teamTasks.id, task.id));
  await logTaskEvent(task.id, ctx.user.id, `${ctx.user.name} cancelled the job`);

  return { slack: await announceTask(task.id, 'cancelled') };
});

export default cancelJob;

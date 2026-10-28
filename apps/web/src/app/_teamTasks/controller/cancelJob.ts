import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
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

  const [updated] = await db
    .update(teamTasks)
    .set({ status: 'cancelled', closedAt: new Date(), closedBy: ctx.user.id })
    .where(and(eq(teamTasks.id, task.id), eq(teamTasks.status, 'open')))
    .returning({ id: teamTasks.id });

  // Someone else changed it between our read and this write
  if (!updated) {
    throw new TRPCError({ code: 'CONFLICT', message: 'This job has just been closed or cancelled by someone else.' });
  }

  await logTaskEvent(task.id, ctx.user.id, `${ctx.user.name} cancelled the job`);

  return { slack: await announceTask(task.id, 'cancelled') };
});

export default cancelJob;

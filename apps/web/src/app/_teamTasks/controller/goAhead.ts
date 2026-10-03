import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import announceTask from '../data/announceTask';
import logTaskEvent from '../data/logTaskEvent';

/**
 * Start a job that was waiting on someone, and announce it in #tasks
 *
 * @example
 *   await trpcClient.teamTasks.goAhead.mutate({ taskId });
 */
const goAhead = teamProcedure.input(z.object({ taskId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, input.taskId));

  if (!task || task.status !== 'open' || !task.waitingOn) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This job is not waiting on anyone.' });
  }

  await db.update(teamTasks).set({ waitingOn: null }).where(eq(teamTasks.id, task.id));
  await logTaskEvent(task.id, ctx.user.id, `${ctx.user.name} recorded the go-ahead (was waiting on ${task.waitingOn})`);

  return { slack: await announceTask(task.id, 'opened') };
});

export default goAhead;

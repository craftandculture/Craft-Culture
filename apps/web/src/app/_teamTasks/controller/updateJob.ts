import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import announceTask from '../data/announceTask';
import logTaskEvent from '../data/logTaskEvent';
import resolveArea from '../data/resolveArea';
import writeParts from '../data/writeParts';
import jobSchema from '../schemas/jobSchema';

/**
 * Edit a job: anyone on the team may change, reassign or re-date it
 *
 * Clearing "waiting on" starts the job, which is announced in #tasks like a
 * new one. Due date changes are written to the job's history.
 *
 * @example
 *   await trpcClient.teamTasks.updateJob.mutate({ taskId, ...job });
 */
const updateJob = teamProcedure
  .input(jobSchema.and(z.object({ taskId: z.string().uuid() })))
  .mutation(async ({ input, ctx }) => {
    const [before] = await db.select().from(teamTasks).where(eq(teamTasks.id, input.taskId));

    if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'That job no longer exists' });

    await db.transaction(async (tx) => {
      const areaId = await resolveArea(tx, input.areaId, input.newAreaName);
      await tx
        .update(teamTasks)
        .set({
          title: input.title,
          areaId,
          forTag: input.forTag,
          urgent: input.urgent,
          waitingOn: input.waitingOn || null,
          repeat: input.repeat,
          linkUrl: input.linkUrl ?? null,
          linkLabel: input.linkUrl ? (input.linkLabel ?? null) : null,
          partnerId: input.partnerId ?? null,
        })
        .where(eq(teamTasks.id, input.taskId));
      await writeParts(tx, input.taskId, input.parts);
    });

    await logTaskEvent(input.taskId, ctx.user.id, `${ctx.user.name} edited the job`);

    const started = Boolean(before.waitingOn) && !input.waitingOn && before.status === 'open';
    if (started) await logTaskEvent(input.taskId, ctx.user.id, `${ctx.user.name} recorded the go-ahead`);
    const slack = started ? await announceTask(input.taskId, 'opened') : { posted: false, reason: null };

    return { slack };
  });

export default updateJob;

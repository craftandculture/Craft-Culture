import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import announceTask from '../data/announceTask';
import logTaskEvent from '../data/logTaskEvent';
import resolveArea from '../data/resolveArea';
import writeParts from '../data/writeParts';
import jobSchema from '../schemas/jobSchema';

/**
 * Add a job, and tell #tasks unless it is waiting on someone
 *
 * @example
 *   await trpcClient.teamTasks.createJob.mutate({ title, areaId, parts, … });
 */
const createJob = teamProcedure.input(jobSchema).mutation(async ({ input, ctx }) => {
  const taskId = await db.transaction(async (tx) => {
    const areaId = await resolveArea(tx, input.areaId, input.newAreaName);
    const [task] = await tx
      .insert(teamTasks)
      .values({
        title: input.title,
        areaId,
        forTag: input.forTag,
        urgent: input.urgent,
        waitingOn: input.waitingOn || null,
        repeat: input.repeat,
        linkUrl: input.linkUrl ?? null,
        linkLabel: input.linkUrl ? (input.linkLabel ?? null) : null,
        partnerId: input.partnerId ?? null,
        createdBy: ctx.user.id,
      })
      .returning({ id: teamTasks.id });
    await writeParts(tx, task!.id, input.parts);
    return task!.id;
  });

  await logTaskEvent(taskId, ctx.user.id, `${ctx.user.name} added the job`);
  const slack = input.waitingOn ? { posted: false, reason: 'waiting' as const } : await announceTask(taskId, 'opened');

  return { taskId, slack };
});

export default createJob;

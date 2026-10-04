import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import announceTask from '../data/announceTask';
import logTaskEvent from '../data/logTaskEvent';
import shiftDue from '../utils/shiftDue';

/**
 * Close a job: the confirmed second step after every part is done
 *
 * Refused while any part is open, so a job cannot be closed by accident or
 * with work outstanding. A repeating job creates its next one straight away,
 * parts unticked and due dates moved on by the repeat period.
 *
 * @example
 *   await trpcClient.teamTasks.closeJob.mutate({ taskId });
 */
const closeJob = teamProcedure.input(z.object({ taskId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, input.taskId));

  if (!task || task.status !== 'open') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This job is not open.' });
  }

  const parts = await db.select().from(teamTaskParts).where(eq(teamTaskParts.taskId, task.id)).orderBy(asc(teamTaskParts.position));

  if (!parts.length || parts.some((p) => !p.done)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Every part must be ticked off before the job can be closed.' });
  }

  await db.update(teamTasks).set({ status: 'closed', closedAt: new Date(), closedBy: ctx.user.id }).where(eq(teamTasks.id, task.id));
  await logTaskEvent(task.id, ctx.user.id, `${ctx.user.name} closed the job`);
  const slack = await announceTask(task.id, 'closed');

  let nextTaskId: string | null = null;
  if (task.repeat === 'weekly' || task.repeat === 'monthly') {
    const repeat = task.repeat;
    nextTaskId = await db.transaction(async (tx) => {
      const [next] = await tx
        .insert(teamTasks)
        .values({
          title: task.title,
          areaId: task.areaId,
          forTag: task.forTag,
          urgent: task.urgent,
          repeat,
          linkUrl: task.linkUrl,
          linkLabel: task.linkLabel,
          partnerId: task.partnerId,
          createdBy: ctx.user.id,
        })
        .returning({ id: teamTasks.id });
      const ids: string[] = [];
      for (const p of parts) {
        const [row] = await tx
          .insert(teamTaskParts)
          .values({ taskId: next!.id, ownerId: p.ownerId, what: p.what, due: p.due ? shiftDue(p.due, repeat) : null, position: p.position })
          .returning({ id: teamTaskParts.id });
        ids.push(row!.id);
      }
      for (const [i, p] of parts.entries()) {
        const waitsIdx = p.waitsForPartId ? parts.findIndex((q) => q.id === p.waitsForPartId) : -1;
        const id = ids.at(i);
        if (waitsIdx >= 0 && id) await tx.update(teamTaskParts).set({ waitsForPartId: ids.at(waitsIdx) ?? null }).where(eq(teamTaskParts.id, id));
      }
      return next!.id;
    });
    await logTaskEvent(nextTaskId, ctx.user.id, `Repeats ${repeat}: created when the previous one was closed`);
    await announceTask(nextTaskId, 'opened');
  }

  return { slack, nextTaskId };
});

export default closeJob;

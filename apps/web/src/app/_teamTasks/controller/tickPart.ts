import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import getTeam from '../data/getTeam';
import logTaskEvent from '../data/logTaskEvent';
import postTasksSlack from '../utils/postTasksSlack';

/**
 * Tick a part off, or untick it
 *
 * Ticking never closes the job: that takes a separate, confirmed close. When
 * a part finishes, anyone whose part was waiting on it is told in #tasks that
 * it is their turn.
 *
 * @example
 *   const { jobReady } = await trpcClient.teamTasks.tickPart.mutate({ partId, done: true });
 */
const tickPart = teamProcedure
  .input(z.object({ partId: z.string().uuid(), done: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    const [part] = await db.select().from(teamTaskParts).where(eq(teamTaskParts.id, input.partId));

    if (!part) throw new TRPCError({ code: 'NOT_FOUND', message: 'That part no longer exists' });

    const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, part.taskId));

    if (!task || task.status !== 'open') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This job is closed. Reopen it to change its parts.' });
    }

    if (input.done && part.waitsForPartId) {
      const [first] = await db.select().from(teamTaskParts).where(eq(teamTaskParts.id, part.waitsForPartId));
      if (first && !first.done) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `This part waits for "${first.what}" to be done first.` });
      }
    }

    await db
      .update(teamTaskParts)
      .set({ done: input.done, doneAt: input.done ? new Date() : null, doneBy: input.done ? ctx.user.id : null })
      .where(eq(teamTaskParts.id, part.id));

    const team = await getTeam();
    const ownerName = team.find((m) => m.id === part.ownerId)?.name ?? 'someone';
    await logTaskEvent(
      task.id,
      ctx.user.id,
      input.done ? `${ctx.user.name} ticked off ${ownerName}'s part: ${part.what}` : `${ctx.user.name} unticked ${ownerName}'s part: ${part.what}`,
    );

    // Your turn: parts that were waiting on this one can now start.
    let slack: { posted: boolean; reason: string | null } = { posted: false, reason: null };
    if (input.done) {
      const waiting = await db
        .select()
        .from(teamTaskParts)
        .where(and(eq(teamTaskParts.waitsForPartId, part.id), eq(teamTaskParts.done, false)));
      if (waiting.length && !task.waitingOn) {
        const tags = waiting.map((w) => {
          const m = team.find((t) => t.id === w.ownerId);
          return `${m?.slackMemberId ? `<@${m.slackMemberId}>` : `*${m?.name ?? 'someone'}*`} ${w.what}`;
        });
        slack = await postTasksSlack(`Your turn on *${task.title}*: ${ownerName} finished "${part.what}".\n${tags.join(' · ')}`);
      }
    }

    const parts = await db.select({ done: teamTaskParts.done }).from(teamTaskParts).where(eq(teamTaskParts.taskId, task.id));

    return { jobReady: parts.length > 0 && parts.every((p) => p.done), slack };
  });

export default tickPart;

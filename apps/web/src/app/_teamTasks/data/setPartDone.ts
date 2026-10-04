import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';

import getPeople from './getPeople';
import logTaskEvent from './logTaskEvent';
import postTasksSlack from '../utils/postTasksSlack';
import slackTag from '../utils/slackTag';

/**
 * Tick a part off or untick it, for the team page and the partner page alike
 *
 * Ticking never closes the job: that takes a separate, confirmed close. A
 * part waiting for another cannot be ticked first. When a part finishes,
 * anyone whose part was waiting on it is told in #tasks that it is their turn.
 *
 * @param partId - The part
 * @param done - Ticked or not
 * @param actor - Who did it, for the history
 * @returns Whether every part of the job is now done, and the Slack result
 */
const setPartDone = async (partId: string, done: boolean, actor: { id: string; name: string }) => {
  const [part] = await db.select().from(teamTaskParts).where(eq(teamTaskParts.id, partId));
  if (!part) throw new TRPCError({ code: 'NOT_FOUND', message: 'That part no longer exists' });

  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, part.taskId));
  if (!task || task.status !== 'open') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This job is closed. Reopen it to change its parts.' });
  }

  if (done && part.waitsForPartId) {
    const [first] = await db.select().from(teamTaskParts).where(eq(teamTaskParts.id, part.waitsForPartId));
    if (first && !first.done) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `This part waits for "${first.what}" to be done first.` });
    }
  }

  await db
    .update(teamTaskParts)
    .set({ done, doneAt: done ? new Date() : null, doneBy: done ? actor.id : null })
    .where(eq(teamTaskParts.id, part.id));

  const people = await getPeople();
  const ownerName = people.find((m) => m.id === part.ownerId)?.name ?? 'someone';
  await logTaskEvent(
    task.id,
    actor.id,
    done ? `${actor.name} ticked off ${ownerName}'s part: ${part.what}` : `${actor.name} unticked ${ownerName}'s part: ${part.what}`,
  );

  // Your turn: parts that were waiting on this one can now start.
  let slack: { posted: boolean; reason: string | null } = { posted: false, reason: null };
  if (done) {
    const waiting = await db
      .select()
      .from(teamTaskParts)
      .where(and(eq(teamTaskParts.waitsForPartId, part.id), eq(teamTaskParts.done, false)));
    if (waiting.length && !task.waitingOn) {
      const tags = waiting.map((w) => `${slackTag(people.find((t) => t.id === w.ownerId))} ${w.what}`);
      slack = await postTasksSlack(`Your turn on *${task.title}*: ${ownerName} finished "${part.what}".\n${tags.join(' · ')}`);
    }
  }

  const parts = await db.select({ done: teamTaskParts.done }).from(teamTaskParts).where(eq(teamTaskParts.taskId, task.id));

  return { jobReady: parts.length > 0 && parts.every((p) => p.done), slack };
};

export default setPartDone;

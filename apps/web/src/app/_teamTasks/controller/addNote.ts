import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskNotes, teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import getTeam from '../data/getTeam';
import logTaskEvent from '../data/logTaskEvent';
import jobLink from '../utils/jobLink';
import postTasksSlack from '../utils/postTasksSlack';
import slackTag from '../utils/slackTag';

/**
 * Add a note to a job and tell the people on it
 *
 * The note is kept with the job, and posted to #tasks tagging everyone with
 * an unfinished part (except the writer), so a note is never left unread.
 *
 * @example
 *   await trpcClient.teamTasks.addNote.mutate({ taskId, body: 'Call booked for Monday' });
 */
const addNote = teamProcedure
  .input(z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }))
  .mutation(async ({ input, ctx }) => {
    const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, input.taskId));

    await db.insert(teamTaskNotes).values({ taskId: input.taskId, userId: ctx.user.id, body: input.body });
    await logTaskEvent(input.taskId, ctx.user.id, `${ctx.user.name} added a note`);

    if (!task) return { slack: { posted: false, reason: null } };

    const [team, parts] = await Promise.all([
      getTeam(),
      db.select({ ownerId: teamTaskParts.ownerId, done: teamTaskParts.done }).from(teamTaskParts).where(eq(teamTaskParts.taskId, task.id)),
    ]);
    const tags = [...new Set(parts.filter((p) => !p.done && p.ownerId !== ctx.user.id).map((p) => p.ownerId))].map((id) =>
      slackTag(team.find((m) => m.id === id)),
    );
    const quoted = input.body.length > 600 ? `${input.body.slice(0, 600)}…` : input.body;

    const slack = await postTasksSlack(
      `Note on ${jobLink(task)} from *${ctx.user.name}*${tags.length ? ` for ${tags.join(' ')}` : ''}:\n> ${quoted.replace(/\n/g, '\n> ')}`,
    );

    return { slack };
  });

export default addNote;

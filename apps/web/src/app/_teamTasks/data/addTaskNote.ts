import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskNotes, teamTaskParts, teamTasks } from '@/database/schema';

import getPeople from './getPeople';
import logTaskEvent from './logTaskEvent';
import jobLink from '../utils/jobLink';
import postTasksSlack from '../utils/postTasksSlack';
import slackTag from '../utils/slackTag';

/**
 * Add a note to a job and tell the people on it, for the team page and the
 * partner page alike
 *
 * The note is kept with the job, and posted to #tasks tagging everyone with
 * an unfinished part (except the writer), so a note is never left unread.
 *
 * @param taskId - The job
 * @param body - The note
 * @param actor - Who wrote it
 * @returns The Slack result
 */
const addTaskNote = async (taskId: string, body: string, actor: { id: string; name: string }) => {
    const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, taskId));

    await db.insert(teamTaskNotes).values({ taskId, userId: actor.id, body });
    await logTaskEvent(taskId, actor.id, `${actor.name} added a note`);

    if (!task) return { posted: false, reason: null };

    const [team, parts] = await Promise.all([
      getPeople(),
      db.select({ ownerId: teamTaskParts.ownerId, done: teamTaskParts.done }).from(teamTaskParts).where(eq(teamTaskParts.taskId, task.id)),
    ]);
    const tags = [...new Set(parts.filter((p) => !p.done && p.ownerId !== actor.id).map((p) => p.ownerId))].map((id) =>
      slackTag(team.find((m) => m.id === id)),
    );
    const quoted = body.length > 600 ? `${body.slice(0, 600)}…` : body;

    const slack = await postTasksSlack(
      `Note on ${jobLink(task)} from *${actor.name}*${tags.length ? ` for ${tags.join(' ')}` : ''}:\n> ${quoted.replace(/\n/g, '\n> ')}`,
    );

    return slack;
};

export default addTaskNote;

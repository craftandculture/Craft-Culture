import { and, eq, inArray, isNull, lt } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';

import getPeople from './getPeople';
import dubaiToday from '../utils/dubaiToday';
import postTasksSlack from '../utils/postTasksSlack';
import shortDate from '../utils/shortDate';

/**
 * Tag the owner of each part that has just gone overdue, once
 *
 * One message lists every part that passed its due date since the last run.
 * Each part is marked as alerted only after Slack accepts the post, so a
 * failed post is retried the next morning rather than lost. Jobs still waiting
 * on someone are skipped: their clock has not started.
 *
 * @returns How many parts were alerted
 */
const sendOverdueAlerts = async () => {
  const today = dubaiToday();

  const rows = await db
    .select({ partId: teamTaskParts.id, what: teamTaskParts.what, due: teamTaskParts.due, ownerId: teamTaskParts.ownerId, title: teamTasks.title })
    .from(teamTaskParts)
    .innerJoin(teamTasks, eq(teamTasks.id, teamTaskParts.taskId))
    .where(
      and(
        eq(teamTasks.status, 'open'),
        isNull(teamTasks.waitingOn),
        eq(teamTaskParts.done, false),
        isNull(teamTaskParts.overdueNotifiedAt),
        lt(teamTaskParts.due, today),
      ),
    );

  if (!rows.length) return { alerted: 0, posted: false };

  const team = await getPeople();
  const tag = (id: string) => {
    const m = team.find((t) => t.id === id);
    return m?.slackMemberId ? `<@${m.slackMemberId}>` : `*${m?.name ?? 'someone'}*`;
  };
  const lines = rows.map((r) => `${tag(r.ownerId)} *${r.title}*: ${r.what} (was due ${shortDate(r.due as string)})`);
  const result = await postTasksSlack(`Overdue:\n${lines.join('\n')}`);

  if (result.posted) {
    await db
      .update(teamTaskParts)
      .set({ overdueNotifiedAt: new Date() })
      .where(inArray(teamTaskParts.id, rows.map((r) => r.partId)));
  }

  return { alerted: result.posted ? rows.length : 0, posted: result.posted };
};

export default sendOverdueAlerts;

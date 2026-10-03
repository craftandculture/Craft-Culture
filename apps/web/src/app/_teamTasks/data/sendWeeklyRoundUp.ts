import { and, eq, gte, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import serverConfig from '@/server.config';

import dubaiToday from '../utils/dubaiToday';
import postTasksSlack from '../utils/postTasksSlack';

/**
 * Friday's round-up in #tasks: what got done this week and what is still open
 *
 * Replaces the weekly PDF: one message, no one assembling it.
 *
 * @returns Whether the post was delivered
 */
const sendWeeklyRoundUp = async () => {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const today = dubaiToday();

  const [closed, open] = await Promise.all([
    db
      .select({ title: teamTasks.title })
      .from(teamTasks)
      .where(and(eq(teamTasks.status, 'closed'), gte(teamTasks.closedAt, weekAgo))),
    db.select({ id: teamTasks.id, urgent: teamTasks.urgent, waitingOn: teamTasks.waitingOn }).from(teamTasks).where(eq(teamTasks.status, 'open')),
  ]);

  const openIds = open.map((t) => t.id);
  const parts = openIds.length
    ? await db
        .select({ taskId: teamTaskParts.taskId, due: teamTaskParts.due, done: teamTaskParts.done })
        .from(teamTaskParts)
        .where(inArray(teamTaskParts.taskId, openIds))
    : [];
  const overdueJobs = new Set(parts.filter((p) => !p.done && p.due && p.due < today).map((p) => p.taskId)).size;

  const list = closed.slice(0, 12).map((c) => `• ${c.title}`).join('\n');
  const more = closed.length > 12 ? `\n…and ${closed.length - 12} more` : '';

  return postTasksSlack(
    [
      `*Week in review*: ${closed.length} job${closed.length === 1 ? '' : 's'} closed this week.`,
      closed.length ? `${list}${more}` : '',
      `Still open: ${open.length} · urgent ${open.filter((t) => t.urgent).length} · overdue ${overdueJobs} · waiting on someone ${open.filter((t) => t.waitingOn).length}`,
      `<${serverConfig.appUrl}/platform/admin/tasks|Open Team Tasks>`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
};

export default sendWeeklyRoundUp;

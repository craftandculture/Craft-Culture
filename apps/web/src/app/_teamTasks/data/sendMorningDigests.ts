import { and, eq, isNull, lte } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getTeam from './getTeam';
import dubaiToday from '../utils/dubaiToday';
import shortDate from '../utils/shortDate';

/** Environment variable for an optional Slack bot token (chat:write) used for private messages */
export const TASKS_BOT_TOKEN_ENV = 'SLACK_TASKS_BOT_TOKEN';

/**
 * Each person's own morning list: what is overdue and what is due today
 *
 * Always lands in the Index bell. When a Slack bot token is set and the person's
 * Slack account is linked, it is also sent as a private Slack message from the
 * app. People with nothing due get nothing.
 *
 * @returns How many people were sent a digest
 */
const sendMorningDigests = async () => {
  const today = dubaiToday();
  const rows = await db
    .select({ taskId: teamTasks.id, title: teamTasks.title, what: teamTaskParts.what, due: teamTaskParts.due, ownerId: teamTaskParts.ownerId })
    .from(teamTaskParts)
    .innerJoin(teamTasks, eq(teamTasks.id, teamTaskParts.taskId))
    .where(and(eq(teamTasks.status, 'open'), isNull(teamTasks.waitingOn), eq(teamTaskParts.done, false), lte(teamTaskParts.due, today)));

  if (!rows.length) return { sent: 0 };

  const team = await getTeam();
  const token = process.env[TASKS_BOT_TOKEN_ENV];
  const url = `${serverConfig.appUrl}/platform/admin/tasks`;
  let sent = 0;

  for (const person of team) {
    const mine = rows.filter((r) => r.ownerId === person.id);
    if (!mine.length) continue;

    const overdue = mine.filter((r) => r.due! < today);
    const dueToday = mine.filter((r) => r.due === today);
    const summary = [overdue.length && `${overdue.length} overdue`, dueToday.length && `${dueToday.length} due today`].filter(Boolean).join(', ');

    await createNotification({
      userId: person.id,
      type: 'action_required',
      title: `Your tasks: ${summary}`,
      message: mine.map((r) => r.title).slice(0, 5).join(' · '),
      entityType: 'team_task',
      actionUrl: '/platform/admin/tasks',
    });

    if (token && person.slackMemberId) {
      const line = (r: (typeof mine)[number]) =>
        `• <${url}?job=${r.taskId}|${r.title.replace(/[<>|]/g, '')}>: ${r.what}${r.due! < today ? ` (was due ${shortDate(r.due!)})` : ''}`;
      const text = [
        `Good morning ${person.name.split(' ')[0]}. On your list: ${summary}.`,
        overdue.length ? `*Overdue*\n${overdue.map(line).join('\n')}` : '',
        dueToday.length ? `*Due today*\n${dueToday.map(line).join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ channel: person.slackMemberId, text }),
        });
        const body = (await res.json()) as { ok: boolean; error?: string };
        if (!body.ok) logger.error('Team Tasks: morning DM failed', { error: body.error });
      } catch (error) {
        logger.error('Team Tasks: morning DM failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    sent += 1;
  }

  return { sent };
};

export default sendMorningDigests;

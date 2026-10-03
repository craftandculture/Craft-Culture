import { asc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import serverConfig from '@/server.config';

import getTeam from './getTeam';
import postTasksSlack from '../utils/postTasksSlack';
import shortDate from '../utils/shortDate';

type Kind = 'opened' | 'closed' | 'reopened' | 'cancelled';

const HEAD: Record<Kind, string> = {
  opened: 'New job',
  closed: 'Closed',
  reopened: 'Reopened',
  cancelled: 'Cancelled',
};

/**
 * Tell #tasks that a job opened, closed, reopened or was cancelled
 *
 * Opened and reopened posts tag each owner with their part, so the @mention
 * reaches them as a Slack notification; owners without a linked Slack ID are
 * named in plain text instead.
 *
 * @example
 *   await announceTask(taskId, 'opened');
 *
 * @param taskId - The job
 * @param kind - What happened
 * @returns Whether the post was delivered
 */
const announceTask = async (taskId: string, kind: Kind) => {
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, taskId));

  if (!task) return { posted: false, reason: 'error' as const };

  const parts = await db
    .select()
    .from(teamTaskParts)
    .where(eq(teamTaskParts.taskId, taskId))
    .orderBy(asc(teamTaskParts.position));
  const team = await getTeam();
  const tag = (userId: string) => {
    const member = team.find((m) => m.id === userId);
    if (!member) return 'someone';
    return member.slackMemberId ? `<@${member.slackMemberId}>` : `*${member.name}*`;
  };

  const link = `${serverConfig.appUrl}/platform/admin/tasks?job=${task.id}`;
  const lines = [`${HEAD[kind]}: *<${link}|${task.title}>*${task.urgent && kind === 'opened' ? ' (urgent)' : ''}`];

  if (kind === 'opened' || kind === 'reopened') {
    const open = parts.filter((p) => !p.done);
    lines.push(
      open.length
        ? open.map((p) => `${tag(p.ownerId)} ${p.what}${p.due ? ` (due ${shortDate(p.due)})` : ''}`).join(' · ')
        : 'No owner yet',
    );
  }

  if (kind === 'opened' && task.repeat) lines.push(`_Repeats ${task.repeat}_`);

  return postTasksSlack(lines.join('\n'));
};

export default announceTask;

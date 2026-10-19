import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import serverConfig from '@/server.config';

import getPeople from './getPeople';
import buildEndOfDayReport, { nextWorkingDay } from '../utils/buildEndOfDayReport';
import dubaiToday from '../utils/dubaiToday';
import postTasksSlack from '../utils/postTasksSlack';

/**
 * Post the end-of-day report to #tasks: done, decisions, blockers, overdue, next
 *
 * Built from Team Tasks so no one writes it. "Today" is the Dubai day.
 *
 * @returns Whether the post was delivered, and the counts behind it
 */
const sendEndOfDayReport = async () => {
  const today = dubaiToday();
  const nextDay = nextWorkingDay(today);
  const dayStart = new Date(`${today}T00:00:00+04:00`);

  const [closed, opened, ticked, open] = await Promise.all([
    db
      .select({ title: teamTasks.title })
      .from(teamTasks)
      .where(and(eq(teamTasks.status, 'closed'), gte(teamTasks.closedAt, dayStart))),
    db.select({ id: teamTasks.id }).from(teamTasks).where(gte(teamTasks.createdAt, dayStart)),
    db
      .select({ id: teamTaskParts.id })
      .from(teamTaskParts)
      .where(and(eq(teamTaskParts.done, true), gte(teamTaskParts.doneAt, dayStart))),
    db
      .select({ id: teamTasks.id, title: teamTasks.title, waitingOn: teamTasks.waitingOn })
      .from(teamTasks)
      .where(eq(teamTasks.status, 'open')),
  ]);

  // Overdue and due-next only count jobs that have started
  const activeIds = open.filter((t) => !t.waitingOn).map((t) => t.id);
  const parts = activeIds.length
    ? await db
        .select({ taskId: teamTaskParts.taskId, what: teamTaskParts.what, due: teamTaskParts.due, ownerId: teamTaskParts.ownerId })
        .from(teamTaskParts)
        .where(and(inArray(teamTaskParts.taskId, activeIds), eq(teamTaskParts.done, false), isNotNull(teamTaskParts.due)))
    : [];

  const people = await getPeople();
  const owner = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';
  const title = (id: string) => open.find((t) => t.id === id)?.title ?? '';

  const text = buildEndOfDayReport({
    today,
    nextDay,
    closed,
    opened: opened.length,
    partsTicked: ticked.length,
    waiting: open.filter((t) => t.waitingOn).map((t) => ({ title: t.title, waitingOn: t.waitingOn as string })),
    overdue: parts
      .filter((p) => (p.due as string) < today)
      .sort((a, b) => (a.due as string).localeCompare(b.due as string))
      .map((p) => ({ title: title(p.taskId), what: p.what, due: p.due as string, owner: owner(p.ownerId) })),
    dueNext: parts
      .filter((p) => p.due === nextDay)
      .map((p) => ({ title: title(p.taskId), what: p.what, owner: owner(p.ownerId) })),
    appUrl: serverConfig.appUrl,
  });

  const result = await postTasksSlack(text);

  return { ...result, closed: closed.length, opened: opened.length, ticked: ticked.length };
};

export default sendEndOfDayReport;

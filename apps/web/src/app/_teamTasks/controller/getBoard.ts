import { and, asc, desc, eq, gte, inArray, ne, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskAreas, teamTaskNotes, teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import getTeam from '../data/getTeam';
import { TASKS_WEBHOOK_ENV } from '../utils/postTasksSlack';

/** How far back the Done tab reaches */
const DONE_DAYS = 60;

/**
 * Everything the Team Tasks page shows, in one read
 *
 * Open jobs, plus jobs closed or cancelled in the last 60 days for the Done
 * tab, with their parts, note counts, the areas, the team and whether the
 * #tasks feed is connected.
 *
 * @example
 *   const board = await trpcClient.teamTasks.getBoard.query();
 */
const getBoard = teamProcedure.query(async ({ ctx }) => {
  const since = new Date(Date.now() - DONE_DAYS * 864e5);

  const [areas, tasks, team] = await Promise.all([
    db.select().from(teamTaskAreas).orderBy(asc(teamTaskAreas.position), asc(teamTaskAreas.name)),
    db
      .select()
      .from(teamTasks)
      .where(or(eq(teamTasks.status, 'open'), and(ne(teamTasks.status, 'open'), gte(teamTasks.closedAt, since))))
      .orderBy(desc(teamTasks.closedAt), asc(teamTasks.createdAt)),
    getTeam(),
  ]);

  const ids = tasks.map((t) => t.id);
  const [parts, noteCounts] = ids.length
    ? await Promise.all([
        db.select().from(teamTaskParts).where(inArray(teamTaskParts.taskId, ids)).orderBy(asc(teamTaskParts.position)),
        db
          .select({ taskId: teamTaskNotes.taskId, count: sql<number>`count(*)::int` })
          .from(teamTaskNotes)
          .where(inArray(teamTaskNotes.taskId, ids))
          .groupBy(teamTaskNotes.taskId),
      ])
    : [[], []];

  const notesByTask = new Map(noteCounts.map((n) => [n.taskId, n.count]));

  return {
    viewerId: ctx.user.id,
    viewerIsAdmin: ctx.user.role === 'admin',
    slackConnected: Boolean(process.env[TASKS_WEBHOOK_ENV]),
    areas: areas.map((a) => ({ id: a.id, name: a.name })),
    team: team.map((m) => ({ id: m.id, name: m.name, linkedToSlack: Boolean(m.slackMemberId), slackMemberId: m.slackMemberId })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      areaId: t.areaId,
      forTag: t.forTag as 'client' | 'distributor' | null,
      urgent: t.urgent,
      waitingOn: t.waitingOn,
      repeat: t.repeat as 'weekly' | 'monthly' | null,
      status: t.status as 'open' | 'closed' | 'cancelled',
      closedAt: t.closedAt,
      noteCount: notesByTask.get(t.id) ?? 0,
      parts: parts
        .filter((p) => p.taskId === t.id)
        .map((p) => ({
          id: p.id,
          ownerId: p.ownerId,
          what: p.what,
          due: p.due,
          done: p.done,
          doneAt: p.doneAt,
          waitsForPartId: p.waitsForPartId,
        })),
    })),
  };
});

export default getBoard;

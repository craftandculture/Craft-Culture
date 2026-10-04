import { and, asc, desc, eq, gte, inArray, ne, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, teamTaskAreas, teamTaskNotes, teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import getPartnerPeople, { SHARE_PARTNER_TYPES } from '../data/getPartnerPeople';
import getTeam from '../data/getTeam';
import personName from '../utils/personName';
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

  const [areas, tasks, team, partnerPeople, partnerList] = await Promise.all([
    db.select().from(teamTaskAreas).orderBy(asc(teamTaskAreas.position), asc(teamTaskAreas.name)),
    db
      .select()
      .from(teamTasks)
      .where(or(eq(teamTasks.status, 'open'), and(ne(teamTasks.status, 'open'), gte(teamTasks.closedAt, since))))
      .orderBy(desc(teamTasks.closedAt), asc(teamTasks.createdAt)),
    getTeam(),
    getPartnerPeople(),
    db
      .select({ id: partners.id, name: partners.businessName })
      .from(partners)
      .where(and(inArray(partners.type, [...SHARE_PARTNER_TYPES]), eq(partners.status, 'active')))
      .orderBy(asc(partners.businessName)),
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
    team: [
      ...team.map((m) => ({
        id: m.id,
        name: personName(m.name),
        linkedToSlack: Boolean(m.slackMemberId),
        slackMemberId: m.slackMemberId,
        partnerId: null as string | null,
      })),
      // Partner people who hold a part on a job shown here, so they are named
      ...partnerPeople
        .filter((p) => !team.some((m) => m.id === p.id) && parts.some((q) => q.ownerId === p.id))
        .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
        .map((p) => ({ id: p.id, name: personName(p.name), linkedToSlack: false, slackMemberId: null, partnerId: p.partnerId as string | null })),
    ],
    partners: partnerList,
    partnerPeople: partnerPeople.map((p) => ({ ...p, name: personName(p.name) })),
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
      closedBy: t.closedBy,
      linkUrl: t.linkUrl,
      linkLabel: t.linkLabel,
      partnerId: t.partnerId,
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

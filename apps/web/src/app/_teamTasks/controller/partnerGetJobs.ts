import { and, asc, desc, eq, gte, inArray, or } from 'drizzle-orm';

import db from '@/database/client';
import { teamTaskNotes, teamTaskParts, teamTasks, users } from '@/database/schema';
import { partnerTaskProcedure } from '@/lib/trpc/procedures';

import getPeople from '../data/getPeople';

/**
 * The jobs C&C has shared with the signed-in partner, with every part and note
 *
 * Open jobs, plus those closed in the last 30 days. Only jobs shared with
 * this partner are ever returned.
 *
 * @example
 *   const { jobs } = await trpcClient.teamTasks.partnerGetJobs.query();
 */
const partnerGetJobs = partnerTaskProcedure.query(async ({ ctx }) => {
  const since = new Date(Date.now() - 30 * 864e5);
  const tasks = await db
    .select()
    .from(teamTasks)
    .where(
      and(
        eq(teamTasks.partnerId, ctx.partnerId),
        or(eq(teamTasks.status, 'open'), and(eq(teamTasks.status, 'closed'), gte(teamTasks.closedAt, since))),
      ),
    )
    .orderBy(asc(teamTasks.status), desc(teamTasks.createdAt));

  const ids = tasks.map((t) => t.id);
  const [parts, notes, people] = await Promise.all([
    ids.length ? db.select().from(teamTaskParts).where(inArray(teamTaskParts.taskId, ids)).orderBy(asc(teamTaskParts.position)) : [],
    ids.length
      ? db
          .select({ id: teamTaskNotes.id, taskId: teamTaskNotes.taskId, body: teamTaskNotes.body, at: teamTaskNotes.createdAt, name: users.name })
          .from(teamTaskNotes)
          .leftJoin(users, eq(users.id, teamTaskNotes.userId))
          .where(inArray(teamTaskNotes.taskId, ids))
          .orderBy(asc(teamTaskNotes.createdAt))
      : [],
    getPeople(),
  ]);

  return {
    viewerId: ctx.user.id,
    partnerName: ctx.partner.businessName,
    jobs: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as 'open' | 'closed' | 'cancelled',
      urgent: t.urgent,
      waitingOn: t.waitingOn,
      closedAt: t.closedAt,
      parts: parts
        .filter((p) => p.taskId === t.id)
        .map((p) => ({
          id: p.id,
          what: p.what,
          due: p.due,
          done: p.done,
          ownerId: p.ownerId,
          ownerName: people.find((m) => m.id === p.ownerId)?.name ?? 'C&C',
          waitsForPartId: p.waitsForPartId,
        })),
      notes: notes.filter((n) => n.taskId === t.id).map(({ taskId: _taskId, ...n }) => n),
    })),
  };
});

export default partnerGetJobs;

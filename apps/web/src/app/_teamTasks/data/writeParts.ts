import { TRPCError } from '@trpc/server';
import { and, eq, notInArray, sql } from 'drizzle-orm';

import { teamTaskParts } from '@/database/schema';

import getPartnerPeople from './getPartnerPeople';
import getTeam from './getTeam';
import type { JobInput } from '../schemas/jobSchema';

/**
 * Every part must go to someone on the C&C team, or to a person of the
 * partner the job is shared with; nobody else can be handed work on it. Whoever
 * already holds a part of this job may keep it (someone who has since left).
 */
const assertOwnersAllowed = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  taskId: string,
  parts: JobInput['parts'],
  partnerId: string | null,
) => {
  if (!parts.length) return;
  const [team, partnerPeople, current] = await Promise.all([
    getTeam(),
    partnerId ? getPartnerPeople() : Promise.resolve([]),
    tx
      .select({ ownerId: teamTaskParts.ownerId })
      .from(teamTaskParts)
      .where(eq(teamTaskParts.taskId, taskId)) as Promise<{ ownerId: string }[]>,
  ]);
  const allowed = new Set([
    ...team.map((m) => m.id),
    ...partnerPeople.filter((p) => p.partnerId === partnerId).map((p) => p.id),
    ...current.map((p) => p.ownerId),
  ]);
  if (parts.some((p) => !allowed.has(p.ownerId))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Each part must go to someone on the team or at the partner sharing this job',
    });
  }
};

/**
 * Make a job's parts match what was entered on the form
 *
 * Existing parts are updated in place, so a part that was already ticked
 * keeps its tick; parts removed on the form are deleted; new ones are added.
 * "Waits for" is entered as a position in the list and stored as the id of
 * that part once every part has one.
 *
 * @param tx - Drizzle handle (the surrounding transaction)
 * @param taskId - The job
 * @param parts - The parts as entered, in order
 * @param partnerId - The partner the job is shared with, if any
 */
const writeParts = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  taskId: string,
  parts: JobInput['parts'],
  partnerId: string | null = null,
) => {
  await assertOwnersAllowed(tx, taskId, parts, partnerId);

  const keepIds = parts.map((p) => p.id).filter((id): id is string => Boolean(id));

  await tx
    .delete(teamTaskParts)
    .where(
      keepIds.length
        ? and(eq(teamTaskParts.taskId, taskId), notInArray(teamTaskParts.id, keepIds))
        : eq(teamTaskParts.taskId, taskId),
    );

  const ids: string[] = [];
  for (const [position, part] of parts.entries()) {
    if (part.id) {
      // Only an owner change or a new due date re-arms the overdue alert;
      // SET reads the row as it was, so the CASE compares old with new.
      const overdueNotifiedAt = sql`CASE WHEN ${teamTaskParts.ownerId} IS DISTINCT FROM ${part.ownerId}::uuid
        OR ${teamTaskParts.due} IS DISTINCT FROM ${part.due}::date
        THEN NULL ELSE ${teamTaskParts.overdueNotifiedAt} END`;
      const updated: { id: string }[] = await tx
        .update(teamTaskParts)
        .set({ ownerId: part.ownerId, what: part.what, due: part.due, position, overdueNotifiedAt })
        .where(and(eq(teamTaskParts.id, part.id), eq(teamTaskParts.taskId, taskId)))
        .returning({ id: teamTaskParts.id });
      // An id from another job is never touched or linked to
      if (!updated.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A part on the form belongs to another job' });
      }
      ids.push(part.id);
    } else {
      const [row] = await tx
        .insert(teamTaskParts)
        .values({ taskId, ownerId: part.ownerId, what: part.what, due: part.due, position })
        .returning({ id: teamTaskParts.id });
      ids.push(row.id);
    }
  }

  for (const [i, part] of parts.entries()) {
    const waits = part.waitsForIndex === null ? null : (ids.at(part.waitsForIndex) ?? null);
    const id = ids.at(i);
    if (id) {
      await tx
        .update(teamTaskParts)
        .set({ waitsForPartId: waits })
        .where(and(eq(teamTaskParts.id, id), eq(teamTaskParts.taskId, taskId)));
    }
  }

  return ids;
};

export default writeParts;

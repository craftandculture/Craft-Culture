import { and, eq, notInArray } from 'drizzle-orm';

import { teamTaskParts } from '@/database/schema';

import type { JobInput } from '../schemas/jobSchema';

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
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const writeParts = async (tx: any, taskId: string, parts: JobInput['parts']) => {
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
      // An owner change or a new due date resets the overdue alert for it.
      await tx
        .update(teamTaskParts)
        .set({ ownerId: part.ownerId, what: part.what, due: part.due, position, overdueNotifiedAt: null })
        .where(and(eq(teamTaskParts.id, part.id), eq(teamTaskParts.taskId, taskId)));
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
    if (id) await tx.update(teamTaskParts).set({ waitsForPartId: waits }).where(eq(teamTaskParts.id, id));
  }

  return ids;
};

export default writeParts;

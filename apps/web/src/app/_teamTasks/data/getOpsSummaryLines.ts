import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { opsCheckItems, teamTaskParts, teamTasks } from '@/database/schema';

import getPeople from './getPeople';

/**
 * The end-of-day report's Ops block: each check's open job and what is left
 *
 * Never throws: if the checks' table is missing the report simply goes out
 * without this block.
 *
 * @example
 *   const lines = await getOpsSummaryLines(); // ['PCOs missing the CD SKU: 3 left (Laraine)']
 *
 * @returns One line per open check job, most left first
 */
const getOpsSummaryLines = async () => {
  try {
    const jobs = await db
      .selectDistinct({ id: teamTasks.id, title: teamTasks.title })
      .from(opsCheckItems)
      .innerJoin(teamTasks, eq(teamTasks.id, opsCheckItems.taskId))
      .where(eq(teamTasks.status, 'open'));
    if (!jobs.length) return [];

    const parts = await db
      .select({ taskId: teamTaskParts.taskId, ownerId: teamTaskParts.ownerId })
      .from(teamTaskParts)
      .where(and(inArray(teamTaskParts.taskId, jobs.map((j) => j.id)), eq(teamTaskParts.done, false)));
    const people = await getPeople();
    const name = (id: string) => people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'someone';

    return jobs
      .map((job) => {
        const left = parts.filter((p) => p.taskId === job.id);
        const owners = [...new Set(left.map((p) => name(p.ownerId)))].join(', ');
        return { left: left.length, line: `${job.title}: ${left.length} left${owners ? ` (${owners})` : ''}` };
      })
      .filter((j) => j.left > 0)
      .sort((a, b) => b.left - a.left)
      .map((j) => j.line);
  } catch {
    return [];
  }
};

export default getOpsSummaryLines;

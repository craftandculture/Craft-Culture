import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

/**
 * The jobs made from one Index page, e.g. every job about one order
 *
 * @example
 *   const jobs = await trpcClient.teamTasks.jobsForLink.query({ linkUrl: '/platform/admin/private-orders/<id>' });
 */
const jobsForLink = teamProcedure.input(z.object({ linkUrl: z.string().max(300) })).query(async ({ input }) => {
  const tasks = await db
    .select({ id: teamTasks.id, title: teamTasks.title, status: teamTasks.status, urgent: teamTasks.urgent })
    .from(teamTasks)
    .where(and(eq(teamTasks.linkUrl, input.linkUrl), inArray(teamTasks.status, ['open', 'closed'])))
    .orderBy(desc(teamTasks.createdAt))
    .limit(10);

  const parts = tasks.length
    ? await db
        .select({ taskId: teamTaskParts.taskId, done: teamTaskParts.done })
        .from(teamTaskParts)
        .where(inArray(teamTaskParts.taskId, tasks.map((t) => t.id)))
    : [];

  return tasks.map((t) => {
    const mine = parts.filter((p) => p.taskId === t.id);
    return { ...t, done: mine.filter((p) => p.done).length, total: mine.length };
  });
});

export default jobsForLink;

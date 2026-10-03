import { TRPCError } from '@trpc/server';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskEvents, teamTaskNotes, teamTasks, users } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

/**
 * A job's notes and history, for the job panel
 *
 * @example
 *   await trpcClient.teamTasks.getTask.query({ taskId });
 */
const getTask = teamProcedure.input(z.object({ taskId: z.string().uuid() })).query(async ({ input }) => {
  const [task] = await db.select({ id: teamTasks.id }).from(teamTasks).where(eq(teamTasks.id, input.taskId));

  if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'That job no longer exists' });

  const [notes, events] = await Promise.all([
    db
      .select({ id: teamTaskNotes.id, body: teamTaskNotes.body, at: teamTaskNotes.createdAt, userId: teamTaskNotes.userId, name: users.name })
      .from(teamTaskNotes)
      .leftJoin(users, eq(users.id, teamTaskNotes.userId))
      .where(eq(teamTaskNotes.taskId, input.taskId))
      .orderBy(asc(teamTaskNotes.createdAt)),
    db
      .select({ id: teamTaskEvents.id, text: teamTaskEvents.text, at: teamTaskEvents.createdAt })
      .from(teamTaskEvents)
      .where(eq(teamTaskEvents.taskId, input.taskId))
      .orderBy(desc(teamTaskEvents.createdAt)),
  ]);

  return { notes, events };
});

export default getTask;

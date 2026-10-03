import { z } from 'zod';

import db from '@/database/client';
import { teamTaskNotes } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

/**
 * Add a note to a job, kept with it for the whole team
 *
 * @example
 *   await trpcClient.teamTasks.addNote.mutate({ taskId, body: 'Call booked for Monday' });
 */
const addNote = teamProcedure
  .input(z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }))
  .mutation(async ({ input, ctx }) => {
    await db.insert(teamTaskNotes).values({ taskId: input.taskId, userId: ctx.user.id, body: input.body });

    return { ok: true };
  });

export default addNote;

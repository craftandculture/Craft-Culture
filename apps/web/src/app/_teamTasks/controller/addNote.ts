import { z } from 'zod';

import { teamProcedure } from '@/lib/trpc/procedures';

import addTaskNote from '../data/addTaskNote';

/**
 * Add a note to a job and tell the people on it in #tasks
 *
 * @example
 *   await trpcClient.teamTasks.addNote.mutate({ taskId, body: 'Call booked for Monday' });
 */
const addNote = teamProcedure
  .input(z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }))
  .mutation(async ({ input, ctx }) => ({ slack: await addTaskNote(input.taskId, input.body, ctx.user) }));

export default addNote;

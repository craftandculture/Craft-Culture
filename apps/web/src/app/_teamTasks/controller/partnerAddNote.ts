import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import { partnerTaskProcedure } from '@/lib/trpc/procedures';

import addTaskNote from '../data/addTaskNote';

/**
 * A partner adds a note to a job shared with them; C&C is told in #tasks
 *
 * @example
 *   await trpcClient.teamTasks.partnerAddNote.mutate({ taskId, body: 'Stock list sent' });
 */
const partnerAddNote = partnerTaskProcedure
  .input(z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }))
  .mutation(async ({ input, ctx }) => {
    const [task] = await db.select({ partnerId: teamTasks.partnerId }).from(teamTasks).where(eq(teamTasks.id, input.taskId));
    if (!task || task.partnerId !== ctx.partnerId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'That job is not shared with you.' });
    }

    await addTaskNote(input.taskId, input.body, { id: ctx.user.id, name: `${ctx.user.name} (${ctx.partner.businessName})` });

    return { ok: true };
  });

export default partnerAddNote;

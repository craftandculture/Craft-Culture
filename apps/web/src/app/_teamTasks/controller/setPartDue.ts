import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import logTaskEvent from '../data/logTaskEvent';
import shortDate from '../utils/shortDate';

/**
 * Change one part's due date from the list, without opening the job form
 *
 * Every change is written to the job's history, and a new date re-arms the
 * one-time overdue alert. An urgent job's part cannot lose its date.
 *
 * @example
 *   await trpcClient.teamTasks.setPartDue.mutate({ partId, due: '2026-10-09' });
 */
const setPartDue = teamProcedure
  .input(z.object({ partId: z.string().uuid(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }))
  .mutation(async ({ input, ctx }) => {
    const [part] = await db.select().from(teamTaskParts).where(eq(teamTaskParts.id, input.partId));
    if (!part) throw new TRPCError({ code: 'NOT_FOUND', message: 'That part no longer exists' });

    const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, part.taskId));
    if (task?.urgent && !input.due) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Urgent jobs need a date on every part.' });
    }
    if (part.due === input.due) return { ok: true };

    await db
      .update(teamTaskParts)
      .set({ due: input.due, overdueNotifiedAt: null, updatedAt: new Date() })
      .where(eq(teamTaskParts.id, part.id));

    const from = part.due ? shortDate(part.due) : 'no date';
    const to = input.due ? shortDate(input.due) : 'no date';
    await logTaskEvent(part.taskId, ctx.user.id, `${ctx.user.name} moved "${part.what}" from ${from} to ${to}`);

    return { ok: true };
  });

export default setPartDue;

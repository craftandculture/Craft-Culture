import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

import getTeam from '../data/getTeam';
import logTaskEvent from '../data/logTaskEvent';
import jobLink from '../utils/jobLink';
import postTasksSlack from '../utils/postTasksSlack';
import slackTag from '../utils/slackTag';

/**
 * Hand one part to someone else, telling them in #tasks
 *
 * @example
 *   await trpcClient.teamTasks.reassignPart.mutate({ partId, ownerId });
 */
const reassignPart = teamProcedure
  .input(z.object({ partId: z.string().uuid(), ownerId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const [part] = await db.select().from(teamTaskParts).where(eq(teamTaskParts.id, input.partId));
    if (!part) throw new TRPCError({ code: 'NOT_FOUND', message: 'That part no longer exists' });
    if (part.ownerId === input.ownerId) return { slack: { posted: false, reason: null } };

    const team = await getTeam();
    const from = team.find((m) => m.id === part.ownerId);
    const to = team.find((m) => m.id === input.ownerId);
    if (!to) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose someone on the team' });

    const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, part.taskId));

    await db
      .update(teamTaskParts)
      .set({ ownerId: input.ownerId, overdueNotifiedAt: null, updatedAt: new Date() })
      .where(eq(teamTaskParts.id, part.id));
    await logTaskEvent(part.taskId, ctx.user.id, `${ctx.user.name} passed "${part.what}" from ${from?.name ?? 'someone'} to ${to.name}`);

    const slack =
      task && task.status === 'open'
        ? await postTasksSlack(`${slackTag(to)} ${ctx.user.name} passed you a part of ${jobLink(task)}: ${part.what}`)
        : { posted: false, reason: null };

    return { slack };
  });

export default reassignPart;

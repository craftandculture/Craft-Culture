import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';
import { partnerTaskProcedure } from '@/lib/trpc/procedures';

import getPartnerPeople from '../data/getPartnerPeople';
import setPartDone from '../data/setPartDone';

/**
 * A partner ticks off (or unticks) one of their own parts of a shared job
 *
 * Only parts belonging to someone at the signed-in partner, on a job shared
 * with that partner, can be changed. C&C's parts are read-only here.
 *
 * @example
 *   await trpcClient.teamTasks.partnerTickPart.mutate({ partId, done: true });
 */
const partnerTickPart = partnerTaskProcedure
  .input(z.object({ partId: z.string().uuid(), done: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    const [row] = await db
      .select({ ownerId: teamTaskParts.ownerId, partnerId: teamTasks.partnerId })
      .from(teamTaskParts)
      .innerJoin(teamTasks, eq(teamTasks.id, teamTaskParts.taskId))
      .where(eq(teamTaskParts.id, input.partId));

    const people = await getPartnerPeople();
    const ours = people.some((p) => p.partnerId === ctx.partnerId && p.id === row?.ownerId);

    if (!row || row.partnerId !== ctx.partnerId || !ours) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only your own parts can be ticked here.' });
    }

    return setPartDone(input.partId, input.done, ctx.user);
  });

export default partnerTickPart;

import { z } from 'zod';

import { teamProcedure } from '@/lib/trpc/procedures';

import setPartDone from '../data/setPartDone';

/**
 * Tick a part off, or untick it
 *
 * Ticking never closes the job: that takes a separate, confirmed close.
 *
 * @example
 *   const { jobReady } = await trpcClient.teamTasks.tickPart.mutate({ partId, done: true });
 */
const tickPart = teamProcedure
  .input(z.object({ partId: z.string().uuid(), done: z.boolean() }))
  .mutation(({ input, ctx }) => setPartDone(input.partId, input.done, ctx.user));

export default tickPart;

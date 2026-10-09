import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import announcePickList from '../data/announcePickList';

/**
 * Admin only: post a pick list to #warehouse-activity again, e.g. to test the
 * feed, or when a post went missing
 *
 * @example
 *   await trpcClient.wms.admin.picking.resendPost.mutate({ pickListId, event: 'completed' });
 */
const adminResendPickListPost = adminProcedure
  .input(z.object({ pickListId: z.string().uuid(), event: z.enum(['released', 'started', 'completed', 'cancelled']) }))
  .mutation(async ({ input, ctx }) => {
    const problem = await announcePickList(input.pickListId, input.event, ctx.user.name);
    if (problem) throw new TRPCError({ code: 'BAD_REQUEST', message: `The post did not go: ${problem}` });
    return { posted: true };
  });

export default adminResendPickListPost;

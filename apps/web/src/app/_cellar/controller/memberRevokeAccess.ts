import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { cellarHolderProcedure } from '@/lib/trpc/procedures';

import revokeAccessGrant from '../data/revokeAccessGrant';

/**
 * Remove someone's access to the holder's cellar, or withdraw an invitation
 *
 * Holder only. Takes effect on the person's very next request.
 */
const memberRevokeAccess = cellarHolderProcedure
  .input(z.object({ grantId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const revoked = await revokeAccessGrant({
      grantId: input.grantId,
      partnerId: ctx.partner.id,
      revokedBy: ctx.user.id,
      notifyDelegate: true,
    });

    if (!revoked) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That person no longer has access. Please refresh.',
      });
    }

    return { name: revoked.name };
  });

export default memberRevokeAccess;

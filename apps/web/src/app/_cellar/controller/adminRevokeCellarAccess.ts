import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyCellarHolder from '../data/notifyCellarHolder';
import revokeAccessGrant from '../data/revokeAccessGrant';

/**
 * Remove someone's shared access to a member's cellar, on the team's side
 *
 * For when a holder asks by phone, or access should end for another reason.
 * The holder and the person are both told.
 */
const adminRevokeCellarAccess = staffAdminProcedure
  .input(z.object({ grantId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const revoked = await revokeAccessGrant({
      grantId: input.grantId,
      revokedBy: ctx.user.id,
      notifyDelegate: true,
    });

    if (!revoked) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That access has already ended.',
      });
    }

    await notifyCellarHolder({
      partnerId: revoked.partnerId,
      title: `${revoked.name} no longer has access to your private cellar`,
      message: `We have removed ${revoked.name}'s access to your private cellar.`,
      path: '/platform/cellar/profile',
    });

    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'cellar_access.revoked',
      entityType: 'cellar_access_grant',
      entityId: revoked.id,
      metadata: { partnerId: revoked.partnerId, email: revoked.email },
    });

    return { name: revoked.name };
  });

export default adminRevokeCellarAccess;

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarAccessGrants } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import notifyCellarHolder from '../data/notifyCellarHolder';
import revokeAccessGrant from '../data/revokeAccessGrant';

/**
 * Give up one's own access to someone else's private cellar
 *
 * A protected procedure rather than a cellar one, because a viewer cannot
 * make changes in the cellar — and leaving must still be open to them.
 */
const leaveCellarAccess = protectedProcedure.mutation(async ({ ctx }) => {
  const [grant] = await db
    .select({ id: cellarAccessGrants.id })
    .from(cellarAccessGrants)
    .where(
      and(
        eq(cellarAccessGrants.userId, ctx.user.id),
        eq(cellarAccessGrants.status, 'active'),
      ),
    )
    .limit(1);

  if (!grant) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'You do not have shared access to a private cellar.',
    });
  }

  const revoked = await revokeAccessGrant({
    grantId: grant.id,
    revokedBy: ctx.user.id,
    notifyDelegate: false,
  });

  if (revoked) {
    await notifyCellarHolder({
      partnerId: revoked.partnerId,
      title: `${revoked.name} no longer has access to your private cellar`,
      message: `${revoked.name} chose to stop having access to your private cellar.`,
      path: '/platform/cellar/profile',
    });
  }

  return { left: Boolean(revoked) };
});

export default leaveCellarAccess;

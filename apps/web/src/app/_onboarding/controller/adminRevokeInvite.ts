import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { cellarInvites } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Withdraw an invitation so its link no longer works
 *
 * The account and cellar it created stay — they hold nothing yet, and a
 * later invite or application reuses them rather than making duplicates.
 */
const adminRevokeInvite = adminProcedure
  .input(z.object({ inviteId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [invite] = await db.select().from(cellarInvites).where(eq(cellarInvites.id, input.inviteId)).limit(1);

    if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
    if (invite.status === 'accepted') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'They have already accepted.' });
    }

    await db.update(cellarInvites).set({ status: 'revoked' }).where(eq(cellarInvites.id, invite.id));

    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'cellar_invite.revoked',
      entityType: 'cellar_invite',
      entityId: invite.id,
      metadata: { email: invite.email },
    });

    return { revoked: true };
  });

export default adminRevokeInvite;

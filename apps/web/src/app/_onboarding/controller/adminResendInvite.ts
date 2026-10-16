import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarInvites } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import sendInvite from '../data/sendInvite';
import newInviteToken from '../utils/newInviteToken';

/**
 * Send an invitation again, with a new link and a fresh fourteen days
 *
 * The old link stops working — only the latest one sent is live.
 */
const adminResendInvite = staffAdminProcedure
  .input(z.object({ inviteId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [invite] = await db.select().from(cellarInvites).where(eq(cellarInvites.id, input.inviteId)).limit(1);

    if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
    if (invite.status === 'accepted') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'They have already accepted.' });
    }

    const { token, tokenHash, expiresAt } = newInviteToken();

    await db
      .update(cellarInvites)
      .set({ tokenHash, expiresAt, status: 'sent', lastSentAt: new Date() })
      .where(eq(cellarInvites.id, invite.id));

    return sendInvite({ token, email: invite.email, name: invite.name, inviterName: ctx.user.name, expiresAt });
  });

export default adminResendInvite;

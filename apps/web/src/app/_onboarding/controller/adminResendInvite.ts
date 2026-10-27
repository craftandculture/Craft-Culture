import { TRPCError } from '@trpc/server';
import { and, eq, gt, ne, sql } from 'drizzle-orm';
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

    /*
      Only a live invitation can be sent again. A revoked one — revoked by
      hand, or superseded when a newer invitation went to the same address —
      stays revoked: resending it brought a withdrawn link back to life
      alongside the one that replaced it.
    */
    if (invite.status !== 'sent' && invite.status !== 'expired') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This invitation has been withdrawn. Send a new invitation instead.',
      });
    }

    const [newer] = await db
      .select({ id: cellarInvites.id })
      .from(cellarInvites)
      .where(
        and(
          sql`lower(${cellarInvites.email}) = ${invite.email.toLowerCase()}`,
          ne(cellarInvites.id, invite.id),
          gt(cellarInvites.createdAt, invite.createdAt),
        ),
      )
      .limit(1);

    if (newer) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A newer invitation has been sent to this address. Resend that one instead.',
      });
    }

    const { token, tokenHash, expiresAt } = newInviteToken();

    const [resent] = await db
      .update(cellarInvites)
      .set({ tokenHash, expiresAt, status: 'sent', lastSentAt: new Date() })
      .where(and(eq(cellarInvites.id, invite.id), eq(cellarInvites.status, invite.status)))
      .returning({ id: cellarInvites.id });

    if (!resent) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This invitation changed while you were resending it. Refresh and try again.',
      });
    }

    return sendInvite({ token, email: invite.email, name: invite.name, inviterName: ctx.user.name, expiresAt });
  });

export default adminResendInvite;

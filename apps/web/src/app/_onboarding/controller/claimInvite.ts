import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarApplications,
  cellarInvites,
  notifications,
  partnerMembers,
  partners,
  users,
} from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import assertNotTradeAccount from '../data/assertNotTradeAccount';
import findLiveInvite from '../data/findLiveInvite';
import getOrCreateApplication from '../data/getOrCreateApplication';

/**
 * Accept an invitation on arriving at the application
 *
 * The invite created the account and the cellar already, so for the person it
 * was sent to this only records the acceptance and ties the application to that
 * cellar. Signed in as someone else — a forwarded link — it is refused: the
 * invite belongs to an email, not to whoever holds the link.
 *
 * Someone who already had an account (an old sign-up still pending) is approved
 * and joined to the invited cellar here, keeping their login.
 */
const claimInvite = protectedProcedure
  .input(z.object({ token: z.string().max(200) }))
  .mutation(async ({ ctx, input }) => {
    await assertNotTradeAccount(ctx.user.id);

    const invite = await findLiveInvite(input.token);

    if (!invite) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          'This invitation has expired or been withdrawn. Please contact us for a new one.',
      });
    }

    if (invite.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This invitation was sent to ${invite.email}. Please sign in with that address.`,
      });
    }

    const application = await getOrCreateApplication(ctx.user.id, invite.name);

    await db.transaction(async (tx) => {
      // A reused email can carry alerts from an old trade or test login; a new
      // member's bell should start clean (kept, just marked read)
      await tx
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.isRead, false),
          ),
        );

      if (ctx.user.approvalStatus !== 'approved') {
        await tx
          .update(users)
          .set({
            approvalStatus: 'approved',
            approvedAt: new Date(),
            approvedBy: invite.invitedBy,
            customerType: 'private_clients',
          })
          .where(eq(users.id, ctx.user.id));
      }

      if (invite.partnerId) {
        // Created inactive if they had a pending account when invited
        await tx
          .update(partners)
          .set({ status: 'active' })
          .where(eq(partners.id, invite.partnerId));

        const [link] = await tx
          .select({ id: partnerMembers.id })
          .from(partnerMembers)
          .where(
            and(
              eq(partnerMembers.partnerId, invite.partnerId),
              eq(partnerMembers.userId, ctx.user.id),
            ),
          )
          .limit(1);

        if (!link) {
          await tx.insert(partnerMembers).values({
            partnerId: invite.partnerId,
            userId: ctx.user.id,
            role: 'owner',
            addedBy: invite.invitedBy,
          });
        }
      }

      await tx
        .update(cellarApplications)
        .set({
          inviteId: invite.id,
          partnerId: application.partnerId ?? invite.partnerId,
          fullName: application.fullName ?? invite.name,
          phone: application.phone ?? invite.phone,
        })
        .where(eq(cellarApplications.id, application.id));

      if (invite.status !== 'accepted') {
        await tx
          .update(cellarInvites)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
            userId: ctx.user.id,
          })
          .where(eq(cellarInvites.id, invite.id));
      }
    });

    return { claimed: true };
  });

export default claimInvite;

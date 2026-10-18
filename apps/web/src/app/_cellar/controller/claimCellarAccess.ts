import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { STOCK_OWNER_PARTNER_TYPES } from '@/app/_auth/constants/accessProfiles';
import assertNotTradeAccount from '@/app/_onboarding/data/assertNotTradeAccount';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import db from '@/database/client';
import {
  cellarAccessGrants,
  partnerMembers,
  partners,
  users,
} from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import findAccessInvitation from '../data/findAccessInvitation';
import notifyCellarHolder from '../data/notifyCellarHolder';

/**
 * Accept an invitation to someone else's private cellar
 *
 * Signed in as the email it was sent to, and no other: a forwarded link is
 * refused. A login that already reaches a cellar or business account of its
 * own is refused too, because one login sees one account.
 *
 * Accepting approves a login that was waiting, and records that it did, so
 * revoking later puts it back. Replaying an accepted link changes nothing.
 */
const claimCellarAccess = protectedProcedure
  .input(z.object({ token: z.string().max(200) }))
  .mutation(async ({ ctx, input }) => {
    const invitation = await findAccessInvitation(input.token);

    if (!invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          'This invitation has expired or been withdrawn. Please ask for a new one.',
      });
    }

    const { grant, holderName } = invitation;

    if (grant.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This invitation was sent to ${grant.email}. Please sign in with that address.`,
      });
    }

    if (grant.status === 'active') {
      if (grant.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This invitation has already been used.',
        });
      }

      return { accepted: true };
    }

    await assertNotTradeAccount(ctx.user.id);

    if (
      ctx.user.approvalStatus === 'approved' &&
      ctx.user.customerType &&
      ctx.user.customerType !== 'private_clients'
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'This email is already used for another account with us. Please ask for the invitation to be sent to a different address.',
      });
    }

    const ownCellar = await resolvePartnerForUser(
      ctx.user.id,
      [...STOCK_OWNER_PARTNER_TYPES],
      ctx.user.partnerId,
    );

    if (ownCellar) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'This email already has a private cellar of its own. Please ask for the invitation to be sent to a different address.',
      });
    }

    const [cellar] = await db
      .select({ status: partners.status })
      .from(partners)
      .where(eq(partners.id, grant.partnerId))
      .limit(1);

    if (cellar?.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This private cellar is not available at the moment.',
      });
    }

    const approvesLogin = ctx.user.approvalStatus !== 'approved';

    await db.transaction(async (tx) => {
      /* Only from invited, so two tabs accepting at once accept it once */
      const [accepted] = await tx
        .update(cellarAccessGrants)
        .set({
          status: 'active',
          userId: ctx.user.id,
          acceptedAt: new Date(),
          approvedOnAccept: approvesLogin,
        })
        .where(
          and(
            eq(cellarAccessGrants.id, grant.id),
            eq(cellarAccessGrants.status, 'invited'),
          ),
        )
        .returning({ id: cellarAccessGrants.id });

      if (!accepted) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This invitation has just been used. Please refresh.',
        });
      }

      await tx.insert(partnerMembers).values({
        partnerId: grant.partnerId,
        userId: ctx.user.id,
        role: grant.role === 'manager' ? 'member' : 'viewer',
        addedBy: grant.invitedBy,
      });

      await tx
        .update(users)
        .set({
          customerType: 'private_clients',
          onboardingCompletedAt: ctx.user.onboardingCompletedAt ?? new Date(),
          ...(approvesLogin
            ? {
                approvalStatus: 'approved' as const,
                approvedAt: new Date(),
                approvedBy: grant.invitedBy,
              }
            : {}),
        })
        .where(eq(users.id, ctx.user.id));
    });

    await notifyCellarHolder({
      partnerId: grant.partnerId,
      title: `${grant.name} now has access to your private cellar`,
      message: `${grant.name} accepted your invitation and can now ${grant.role === 'manager' ? 'view and manage' : 'view'} your private cellar. You can change or remove this at any time from your profile.`,
      path: '/platform/cellar/profile',
    });

    return { accepted: true, holderName };
  });

export default claimCellarAccess;

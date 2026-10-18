import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { STOCK_OWNER_PARTNER_TYPES } from '@/app/_auth/constants/accessProfiles';
import findTradeAccount from '@/app/_onboarding/data/findTradeAccount';
import newInviteToken from '@/app/_onboarding/utils/newInviteToken';
import sendOnboardingEmail from '@/app/_onboarding/utils/sendOnboardingEmail';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import db from '@/database/client';
import { cellarAccessGrants, users } from '@/database/schema';
import { cellarHolderProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';

import accessLevels from '../constants/accessLevels';

/** People a cellar can be shared with at once, invitations included */
const MAX_SHARED = 5;

/**
 * Give someone access to the holder's private cellar
 *
 * Holder only. The invitation is to an email, not to whoever holds the link:
 * it can only be accepted signed in as that address. Inviting the same email
 * again replaces an invitation not yet accepted.
 *
 * The link is returned whether or not the email was sent — until its Loops
 * template exists it is not, and the holder passes the link on themselves.
 */
const memberInviteAccess = cellarHolderProcedure
  .input(
    z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      role: z.enum(['viewer', 'manager']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.email === ctx.user.email.toLowerCase()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That is your own email address.',
      });
    }

    const [existing] = await db
      .select({ id: users.id, partnerId: users.partnerId })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);

    /*
      One login sees one cellar. Someone who already has their own private
      cellar, or a business account with us, needs a different email to be
      given access to this one — otherwise they would see one or the other
      depending on which link happened to be found first.
    */
    if (existing) {
      const business = await findTradeAccount(existing.id);
      const cellar = await resolvePartnerForUser(
        existing.id,
        [...STOCK_OWNER_PARTNER_TYPES],
        existing.partnerId,
      );

      if (business || cellar) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            cellar?.id === ctx.partner.id
              ? `${input.email} already has access to your private cellar.`
              : `${input.email} is already used for another account with us. Please ask them for a different email address.`,
        });
      }
    }

    const live = await db
      .select({
        id: cellarAccessGrants.id,
        email: cellarAccessGrants.email,
        status: cellarAccessGrants.status,
      })
      .from(cellarAccessGrants)
      .where(
        and(
          eq(cellarAccessGrants.partnerId, ctx.partner.id),
          inArray(cellarAccessGrants.status, ['invited', 'active']),
        ),
      );

    if (
      live.some(
        (grant) =>
          grant.status === 'active' && grant.email.toLowerCase() === input.email,
      )
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${input.email} already has access to your private cellar.`,
      });
    }

    const others = live.filter(
      (grant) => grant.email.toLowerCase() !== input.email,
    );

    if (others.length >= MAX_SHARED) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Your private cellar can be shared with up to ${MAX_SHARED} people. Please remove someone first.`,
      });
    }

    const { token, tokenHash, expiresAt } = newInviteToken();

    await db.transaction(async (tx) => {
      await tx
        .update(cellarAccessGrants)
        .set({ status: 'revoked', revokedAt: new Date(), revokedBy: ctx.user.id })
        .where(
          and(
            eq(cellarAccessGrants.partnerId, ctx.partner.id),
            eq(cellarAccessGrants.status, 'invited'),
            sql`lower(${cellarAccessGrants.email}) = ${input.email}`,
          ),
        );

      await tx.insert(cellarAccessGrants).values({
        partnerId: ctx.partner.id,
        email: input.email,
        name: input.name,
        role: input.role,
        status: 'invited',
        tokenHash,
        invitedBy: ctx.user.id,
        expiresAt,
      });
    });

    const acceptUrl = `${serverConfig.appUrl}/cellar-access?token=${token}`;

    const emailed = await sendOnboardingEmail('cellarAccessInvite', input.email, {
      name: input.name,
      holderName: ctx.partner.businessName,
      accessLevel: accessLevels[input.role].label,
      acceptUrl,
      expiresOn: expiresAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
      }),
    });

    return { acceptUrl, emailed };
  });

export default memberInviteAccess;

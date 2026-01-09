import { and, eq } from 'drizzle-orm';

import type { CurrentUser } from '@/app/_auth/data/getCurrentUser';
import db from '@/database/client';
import type { Partner } from '@/database/schema';
import { partnerMembers, partners } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

type PartnerInfo = Pick<Partner, 'id' | 'type' | 'businessName' | 'logoUrl' | 'brandColor'>;

interface UserWithPartner extends CurrentUser {
  partner: PartnerInfo | null;
}

/**
 * Get the current user's profile with partner information
 *
 * For private_clients users, partner is resolved in this priority:
 * 1. Member link (partnerMembers table) - PRIMARY source of truth
 * 2. Direct owner link (partners.userId) - FALLBACK
 *
 * This matches the priority order in winePartnerProcedure.
 */
const usersGetMe = protectedProcedure.query(async ({ ctx }): Promise<UserWithPartner> => {
  // Get partner info if user has one
  let partner: PartnerInfo | null = null;

  if (ctx.user.customerType === 'private_clients') {
    // PRIMARY: Check partnerMembers table first (admin-assigned memberships)
    // This matches the priority order in winePartnerProcedure
    const membershipResult = await db
      .select({
        id: partners.id,
        type: partners.type,
        businessName: partners.businessName,
        logoUrl: partners.logoUrl,
        brandColor: partners.brandColor,
      })
      .from(partnerMembers)
      .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
      .where(
        and(
          eq(partnerMembers.userId, ctx.user.id),
          eq(partners.type, 'wine_partner'),
        ),
      )
      .limit(1);

    if (membershipResult[0]) {
      partner = membershipResult[0];
    } else {
      // FALLBACK: Check direct owner link (partners.userId)
      const directPartnerResult = await db
        .select({
          id: partners.id,
          type: partners.type,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
          brandColor: partners.brandColor,
        })
        .from(partners)
        .where(
          and(eq(partners.userId, ctx.user.id), eq(partners.type, 'wine_partner')),
        )
        .limit(1);

      partner = directPartnerResult[0] ?? null;
    }
  }

  return {
    ...ctx.user,
    partner,
  };
});

export default usersGetMe;

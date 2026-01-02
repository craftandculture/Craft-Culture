import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import type { Partner, User } from '@/database/schema';
import { partnerMembers, partners } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

type PartnerInfo = Pick<Partner, 'id' | 'type' | 'businessName' | 'logoUrl' | 'brandColor'>;

interface UserWithPartner extends User {
  firstName: string | null;
  lastName: string | null;
  partner: PartnerInfo | null;
}

/**
 * Get the current user's profile with partner information
 *
 * For private_clients users, this checks both:
 * 1. Direct owner link (partners.userId)
 * 2. Member link (partnerMembers table)
 */
const usersGetMe = protectedProcedure.query(async ({ ctx }): Promise<UserWithPartner> => {
  // Get partner info if user has one
  let partner: PartnerInfo | null = null;

  if (ctx.user.customerType === 'private_clients') {
    // First check direct owner link
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

    if (directPartnerResult[0]) {
      partner = directPartnerResult[0];
    } else {
      // Check partnerMembers table for wine partner membership
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

      partner = membershipResult[0] ?? null;
    }
  }

  return {
    ...ctx.user,
    partner,
  };
});

export default usersGetMe;

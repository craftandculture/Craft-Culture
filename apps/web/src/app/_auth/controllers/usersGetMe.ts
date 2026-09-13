import type { CurrentUser } from '@/app/_auth/data/getCurrentUser';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import type { Partner } from '@/database/schema';
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
  /*
    Any partner type the user could be linked to, not just wine_partner.

    This resolves the `partner` that every navigation branch reads. Looking for
    wine partners alone meant a private collector came back with `partner: null`
    and silently lost their whole portal — the links are gated on the type, so
    an unresolved partner fails closed and looks like a permissions bug.
  */
  let partner: PartnerInfo | null = null;

  if (ctx.user.customerType === 'private_clients') {
    const resolved = await resolvePartnerForUser(
      ctx.user.id,
      ['wine_partner', 'private_collector', 'distributor'],
      ctx.user.partnerId,
    );

    partner = resolved
      ? {
          id: resolved.id,
          type: resolved.type,
          businessName: resolved.businessName,
          logoUrl: resolved.logoUrl,
          brandColor: resolved.brandColor,
        }
      : null;
  }

  return {
    ...ctx.user,
    partner,
  };
});

export default usersGetMe;

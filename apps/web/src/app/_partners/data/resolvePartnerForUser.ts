import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import type { Partner } from '@/database/schema';
import { partnerMembers, partners } from '@/database/schema';

/** The partner types a login can be attached to */
export type LinkablePartnerType =
  | 'wine_partner'
  | 'distributor'
  | 'private_collector';

/**
 * Find the partner a user acts on behalf of
 *
 * There are three ways a user comes to be linked to a partner, and they are
 * checked in order of authority: an explicit membership granted by an admin,
 * ownership of the partner record, and finally the legacy `users.partnerId`
 * column that predates both.
 *
 * This lookup was written out three separate times — twice in
 * `lib/trpc/procedures.ts` and again in `usersGetMe` — each with the partner
 * type hard-coded. Adding a fourth type by copying it a third time is how the
 * copies drift apart, and a nav that disagrees with an API gate is a user
 * staring at a link that then refuses them.
 *
 * @example
 *   const partner = await resolvePartnerForUser(userId, ['wine_partner']);
 *
 * @param userId - The signed-in user
 * @param types - Which partner types are acceptable to the caller
 * @param legacyPartnerId - The user's own `partnerId`, for the deprecated path
 * @returns The partner, or null when the user is linked to none of these types
 */
const resolvePartnerForUser = async (
  userId: string,
  types: LinkablePartnerType[],
  legacyPartnerId?: string | null,
): Promise<Partner | null> => {
  // PRIMARY: an admin-granted membership
  const [membership] = await db
    .select({ partner: partners })
    .from(partnerMembers)
    .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
    .where(
      and(eq(partnerMembers.userId, userId), inArray(partners.type, types)),
    )
    .limit(1);

  if (membership?.partner) return membership.partner;

  // FALLBACK 1: the user owns the partner record
  const [owned] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.userId, userId), inArray(partners.type, types)))
    .limit(1);

  if (owned) return owned;

  // FALLBACK 2: the deprecated column on the user
  if (legacyPartnerId) {
    const [legacy] = await db
      .select()
      .from(partners)
      .where(
        and(eq(partners.id, legacyPartnerId), inArray(partners.type, types)),
      )
      .limit(1);

    if (legacy) return legacy;
  }

  return null;
};

export default resolvePartnerForUser;

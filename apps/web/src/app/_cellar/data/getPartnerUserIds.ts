import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerMembers, partners } from '@/database/schema';

/**
 * Everyone signed in to a member's cellar
 *
 * The partner's own login and anyone the cellar is shared with: a partner can
 * be an owner, a membership, or both, so either alone misses people.
 *
 * @param partnerId - The member's cellar
 * @returns Distinct user ids
 */
const getPartnerUserIds = async (partnerId: string) => {
  const [owner] = await db
    .select({ userId: partners.userId })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  const members = await db
    .select({ userId: partnerMembers.userId })
    .from(partnerMembers)
    .where(eq(partnerMembers.partnerId, partnerId));

  return [
    ...new Set(
      [...members.map((member) => member.userId), owner?.userId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
};

export default getPartnerUserIds;

import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerMembers } from '@/database/schema';

/**
 * What a user may do for a wine partner: owner, member or viewer
 *
 * The role on their membership decides. A user linked another way (owning the
 * partner record, or the legacy `users.partnerId`) has no membership row and
 * is treated as the owner, which is what those links have always meant.
 *
 * @param partnerId - The partner they act for
 * @param userId - The signed-in user
 * @returns owner | member | viewer
 */
const getPartnerMemberRole = async (partnerId: string, userId: string) => {
  const [membership] = await db
    .select({ role: partnerMembers.role })
    .from(partnerMembers)
    .where(and(eq(partnerMembers.partnerId, partnerId), eq(partnerMembers.userId, userId)))
    .limit(1);

  return membership?.role ?? 'owner';
};

export default getPartnerMemberRole;

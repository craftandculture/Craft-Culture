import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';

/**
 * The users of a partner record: its members, and its legacy owner
 *
 * @param partnerId - The partner (wine partner or distributor)
 * @returns Each user's id, email and name
 */
const getPartnerUsers = async (partnerId: string) => {
  const [members, [owner]] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(partnerMembers)
      .innerJoin(users, eq(partnerMembers.userId, users.id))
      .where(eq(partnerMembers.partnerId, partnerId)),
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(partners)
      .innerJoin(users, eq(partners.userId, users.id))
      .where(eq(partners.id, partnerId)),
  ]);

  return [...members, ...(owner ? [owner] : [])];
};

export default getPartnerUsers;

import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';

/** Partner kinds whose people can be given a part of a shared job */
export const SHARE_PARTNER_TYPES = ['wine_partner', 'distributor', 'private_collector'] as const;

/**
 * Everyone who signs in for a partner (members and owners), by partner
 *
 * These are the people a shared job's parts can be given to. C&C staff are
 * left out: they are on the team list already.
 *
 * @returns One row per person per partner
 */
const getPartnerPeople = async () => {
  const [members, owners] = await Promise.all([
    db
      .select({ partnerId: partnerMembers.partnerId, id: users.id, name: users.name, email: users.email })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
      .where(inArray(partners.type, [...SHARE_PARTNER_TYPES])),
    db
      .select({ partnerId: partners.id, id: users.id, name: users.name, email: users.email })
      .from(partners)
      .innerJoin(users, eq(users.id, partners.userId))
      .where(inArray(partners.type, [...SHARE_PARTNER_TYPES])),
  ]);

  const seen = new Set<string>();
  return [...members, ...owners]
    .filter((p) => !p.email.toLowerCase().endsWith('@craftculture.xyz'))
    .filter((p) => {
      const key = `${p.partnerId}:${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ partnerId, id, name }) => ({ partnerId, id, name }));
};

export default getPartnerPeople;

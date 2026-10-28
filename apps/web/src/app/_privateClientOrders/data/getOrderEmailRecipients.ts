import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

import getPartnerUsers from './getPartnerUsers';

/**
 * The people at a partner or distributor who receive its order emails
 *
 * Its users and its business address, each address once.
 *
 * @param partnerId - The wine partner or distributor
 * @returns Addresses with the name to greet
 */
const getOrderEmailRecipients = async (partnerId: string) => {
  const [people, [business]] = await Promise.all([
    getPartnerUsers(partnerId),
    db
      .select({ name: partners.businessName, email: partners.businessEmail })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1),
  ]);

  const byEmail = new Map<string, { email: string; name: string }>();
  for (const person of people) {
    if (!person.email) continue;
    byEmail.set(person.email.trim().toLowerCase(), { email: person.email.trim(), name: person.name || business?.name || '' });
  }
  if (business?.email && !byEmail.has(business.email.trim().toLowerCase())) {
    byEmail.set(business.email.trim().toLowerCase(), { email: business.email.trim(), name: business.name });
  }
  return [...byEmail.values()];
};

export default getOrderEmailRecipients;

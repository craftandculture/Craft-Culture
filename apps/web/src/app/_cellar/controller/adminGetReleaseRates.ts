import { asc, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * The house rate card, and where every member stands against it
 *
 * Members are listed whether or not they have a card of their own, because
 * the question this screen answers is "what is each member charged" — and
 * "the house rate, because nobody has set one" is an answer to that. A member
 * who is missing from the list would instead read as a member who is not
 * chargeable.
 */
const adminGetReleaseRates = adminProcedure.query(async () => {
  const [rates, members] = await Promise.all([
    db.select().from(cellarReleaseRates),
    db
      .select({
        id: partners.id,
        name: partners.businessName,
        type: partners.type,
        status: partners.status,
      })
      .from(partners)
      .where(inArray(partners.type, ['private_collector', 'wine_partner']))
      .orderBy(asc(partners.businessName)),
  ]);

  const houseRate = rates.find((rate) => rate.partnerId === null) ?? null;

  return {
    houseRate,
    members: members
      .filter((member) => member.status === 'active')
      .map((member) => ({
        ...member,
        rate: rates.find((rate) => rate.partnerId === member.id) ?? null,
      })),
  };
});

export default adminGetReleaseRates;

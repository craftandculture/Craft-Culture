import { asc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * The house rate card, and where every member stands against it
 *
 * Private collectors only. Wine partners and distributors already carry their
 * own value chain on the partner record — margin, logistics per case, duty and
 * VAT for a PCO — and offering them a release card as well would create a
 * second set of numbers for the same customer, with nothing to say which one
 * governs.
 *
 * Collectors are listed whether or not they have a card of their own, because
 * the question this screen answers is "what is each member charged" — and
 * "the house rate, because nobody has set one" is an answer to that. A member
 * missing from the list would instead read as a member who is not chargeable.
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
      .where(eq(partners.type, 'private_collector'))
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

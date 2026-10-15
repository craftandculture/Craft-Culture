import { eq, inArray } from 'drizzle-orm';

import countChargeableCases from '@/app/_cellar/utils/countChargeableCases';
import monthlyMembershipCharge from '@/app/_cellar/utils/monthlyMembershipCharge';
import db from '@/database/client';
import { cellarMemberships, partners, wmsStock } from '@/database/schema';

import getMembershipTerms from './getMembershipTerms';

/**
 * This month's storage charge for every billed member
 *
 * Cases are counted as held now, by the same rule the member sees. The
 * figure pushed to Zoho is the case count over the allowance; the price per
 * case is the add-on's price in Zoho.
 *
 * @returns One row per membership
 */
const getStorageCharges = async () => {
  const memberships = await db
    .select({ membership: cellarMemberships, name: partners.businessName })
    .from(cellarMemberships)
    .innerJoin(partners, eq(partners.id, cellarMemberships.partnerId));

  const ids = memberships.map((row) => row.membership.partnerId);
  const stock = ids.length
    ? await db
        .select({
          ownerId: wmsStock.ownerId,
          quantityCases: wmsStock.quantityCases,
          openBottles: wmsStock.openBottles,
          bottleSize: wmsStock.bottleSize,
          caseConfig: wmsStock.caseConfig,
        })
        .from(wmsStock)
        .where(inArray(wmsStock.ownerId, ids))
    : [];

  return Promise.all(
    memberships.map(async ({ membership, name }) => {
      const terms = await getMembershipTerms(membership.partnerId);
      const cases = countChargeableCases(stock.filter((row) => row.ownerId === membership.partnerId));

      return {
        membershipId: membership.id,
        partnerId: membership.partnerId,
        name,
        status: membership.status,
        zohoSubscriptionId: membership.zohoSubscriptionId,
        lastPushedFor: membership.lastExtraCasesPushedFor,
        nextBillingAt: membership.nextBillingAt,
        cases,
        terms,
        ...monthlyMembershipCharge(cases, terms),
      };
    }),
  );
};

export default getStorageCharges;

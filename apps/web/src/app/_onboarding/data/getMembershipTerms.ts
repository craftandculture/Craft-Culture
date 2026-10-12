import { eq, isNull, or } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates } from '@/database/schema';

/**
 * The membership price a member is on
 *
 * Their own rate card if they have one, otherwise the default card every member
 * falls back to — the same lookup releases use, so terms set on Partners →
 * Release Rates are the terms shown and charged. The figures in the fallback
 * are only used if no rate card exists at all.
 *
 * @param partnerId - The member, or omit for the default terms
 * @returns The monthly fee, cases included, and the charge per extra case
 */
const getMembershipTerms = async (partnerId?: string | null) => {
  const cards = await db
    .select({
      partnerId: cellarReleaseRates.partnerId,
      membershipFeeAed: cellarReleaseRates.membershipFeeAed,
      includedCases: cellarReleaseRates.includedCases,
      extraCaseMonthlyAed: cellarReleaseRates.extraCaseMonthlyAed,
    })
    .from(cellarReleaseRates)
    .where(
      partnerId
        ? or(eq(cellarReleaseRates.partnerId, partnerId), isNull(cellarReleaseRates.partnerId))
        : isNull(cellarReleaseRates.partnerId),
    );

  const card =
    cards.find((row) => row.partnerId === partnerId) ??
    cards.find((row) => row.partnerId === null);

  return {
    membershipFeeAed: card?.membershipFeeAed ?? 600,
    includedCases: card?.includedCases ?? 20,
    extraCaseMonthlyAed: card?.extraCaseMonthlyAed ?? 30,
  };
};

export default getMembershipTerms;

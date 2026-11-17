import { eq, isNull, or } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates, partners } from '@/database/schema';
import type { PCOPricingVariables } from '@/lib/pricing/types';

/**
 * A Private Cellar member's PCO pricing, read from their cellar rate card
 *
 * A member is a partner in their own right on their orders, and their value
 * chain is the one in the Rates section of their Private Cellar: their own
 * card where one has been keyed, otherwise the house tariff (the card with no
 * partner). Read from the card every time rather than copied into the PCO
 * module's bespoke table, so the two can never disagree: whatever is changed
 * in the Rates section is what the next PCO prices at.
 *
 * The card's figures map one to one: C&C margin, duty, distributor margin and
 * VAT as percentages, and its transfer per bottle as the fixed handling fee
 * before the in-bond price. The card has no percentage transfer, so that is
 * zero.
 *
 * @example
 *   await getCellarMemberPCOVariables(ihabTomaId);
 *   // { ccMarginPercent: 2.5, ..., handlingPerBottleUsd: 2.5, source: 'house' }
 *   await getCellarMemberPCOVariables(cruWineId); // null, not a member
 *
 * @param partnerId - The order's partner
 * @returns The member's variables and which card they came from, or null for
 *   anyone who is not a Private Cellar member or when no card exists
 */
const getCellarMemberPCOVariables = async (partnerId: string) => {
  const [partner] = await db
    .select({ type: partners.type })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  if (partner?.type !== 'private_collector') return null;

  const rows = await db
    .select()
    .from(cellarReleaseRates)
    .where(
      or(
        eq(cellarReleaseRates.partnerId, partnerId),
        isNull(cellarReleaseRates.partnerId),
      ),
    );

  // The member's own card beats the house tariff
  const own = rows.find((row) => row.partnerId === partnerId);
  const rate = own ?? rows.find((row) => row.partnerId === null);

  if (!rate) return null;

  const variables: PCOPricingVariables = {
    ccMarginPercent: rate.ccMarginPct,
    importDutyPercent: rate.dutyPct,
    transferCostPercent: 0,
    distributorMarginPercent: rate.distributorMarginPct,
    vatPercent: rate.vatPct,
    handlingPerBottleUsd: rate.transferPerBottle,
  };

  return {
    variables,
    source: own ? ('bespoke' as const) : ('house' as const),
    version: rate.version,
  };
};

export default getCellarMemberPCOVariables;

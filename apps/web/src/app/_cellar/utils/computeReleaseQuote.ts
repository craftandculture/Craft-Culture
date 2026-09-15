import { eq, isNull, or } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates } from '@/database/schema';

import priceFromRateCard, {
  type ReleasePricing,
} from './priceFromRateCard';

export interface ReleaseLine {
  bottles: number;
  caseConfig: number | null;
  /** What the wine was worth on import, per bottle */
  costPerBottle?: number | null;
}

export interface ReleaseQuote extends ReleasePricing {
  /** False when no rates are configured and the figures are all zero */
  priced: boolean;
}

/**
 * Price a release from the member's own rate card
 *
 * Four things are charged: what the state takes (duty), what the work costs
 * (clearance, transfer, the drive), what the licensed partner delivering it
 * takes, and what C&C earns. The last two are kept apart in the result so a
 * release can be reported on, even though the member sees them folded into
 * two lines and a service fee.
 *
 * Cases are derived from bottles rather than taken as given: a member asking
 * for three bottles out of a six-pack is still a case being opened, handled
 * and carried, and charging them for half a case of work would be wrong in the
 * other direction.
 *
 * Falls back to the house default when a member has no rates of their own, so
 * someone who joined this morning is still quotable.
 *
 * @example
 *   const quote = await computeReleaseQuote(partnerId, [
 *     { bottles: 3, caseConfig: 6, costPerBottle: 110 },
 *   ]);
 *
 * @param partnerId - Whose wine is being released
 * @param lines - What they have asked for
 * @returns The quote, and whether any rate was actually found
 */
const computeReleaseQuote = async (
  partnerId: string,
  lines: ReleaseLine[],
): Promise<ReleaseQuote> => {
  const rows = await db
    .select()
    .from(cellarReleaseRates)
    .where(
      or(
        eq(cellarReleaseRates.partnerId, partnerId),
        isNull(cellarReleaseRates.partnerId),
      ),
    );

  // A member's own card beats the house default.
  const rate =
    rows.find((row) => row.partnerId === partnerId) ??
    rows.find((row) => row.partnerId === null);

  const bottles = lines.reduce((sum, line) => sum + line.bottles, 0);

  const cases = lines.reduce(
    (sum, line) => sum + Math.ceil(line.bottles / Math.max(1, line.caseConfig ?? 1)),
    0,
  );

  /*
    A line taking a part case breaks exactly one sealed case, however many
    bottles it takes from it. Singles can never break anything.
  */
  const repackCases = lines.reduce((sum, line) => {
    const pack = Math.max(1, line.caseConfig ?? 1);

    return sum + (pack > 1 && line.bottles % pack !== 0 ? 1 : 0);
  }, 0);

  const goodsValueUsd = lines.reduce(
    (sum, line) => sum + line.bottles * (line.costPerBottle ?? 0),
    0,
  );

  if (!rate) {
    return {
      version: 'none',
      goodsValueUsd,
      dutyUsd: 0,
      vatUsd: 0,
      transferUsd: 0,
      deliveryUsd: 0,
      repackUsd: 0,
      repackCases: 0,
      distributorMarginUsd: 0,
      ccMarginUsd: 0,
      clearanceTotalUsd: 0,
      serviceFeeUsd: 0,
      totalUsd: 0,
      priced: false,
    };
  }

  return {
    ...priceFromRateCard(rate, { bottles, cases, repackCases, goodsValueUsd }),
    priced: true,
  };
};

export default computeReleaseQuote;

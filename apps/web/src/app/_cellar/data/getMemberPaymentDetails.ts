import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarPaymentSettings } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * C&C's bank details for members paying for wine, or null if none are set
 *
 * There can be a dollar account and a dirham account. A member paying an AED
 * invoice is shown the AED account, and a dollar payment the USD one; where
 * only one is set, that one is shown, whatever the currency.
 *
 * Never throws: a purchase list is worth more than its bank panel, so if the
 * table is missing (a migration that did not run) the page shows its fallback
 * instead of failing.
 *
 * @param currency - What the member is paying in (USD by default)
 * @returns The details, or null
 */
const getMemberPaymentDetails = async (currency: 'USD' | 'AED' = 'USD') => {
  try {
    const [row] = await db
      .select({ details: cellarPaymentSettings.details })
      .from(cellarPaymentSettings)
      .where(eq(cellarPaymentSettings.id, 'house'))
      .limit(1);

    const details = row?.details ?? null;
    if (!details) return null;

    const { aed, ...usd } = details;
    const usdSet = Boolean(usd.iban || usd.accountNumber);
    const aedSet = Boolean(aed && (aed.iban || aed.accountNumber));

    if (currency === 'AED' && aedSet) return { ...aed!, currency: 'AED', note: usd.note };
    if (usdSet) return usd;
    if (aedSet) return { ...aed!, currency: 'AED', note: usd.note };
    return null;
  } catch (error) {
    logger.error('Could not read cellar payment details', { error });
    return null;
  }
};

export default getMemberPaymentDetails;

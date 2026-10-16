import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarPaymentSettings } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * C&C's bank details for members paying for wine, or null if none are set
 *
 * Never throws: a purchase list is worth more than its bank panel, so if the
 * table is missing (a migration that did not run) the page shows its fallback
 * instead of failing.
 *
 * @returns The details, or null
 */
const getMemberPaymentDetails = async () => {
  try {
    const [row] = await db
      .select({ details: cellarPaymentSettings.details })
      .from(cellarPaymentSettings)
      .where(eq(cellarPaymentSettings.id, 'house'))
      .limit(1);

    const details = row?.details ?? null;
    return details && (details.iban || details.accountNumber) ? details : null;
  } catch (error) {
    logger.error('Could not read cellar payment details', { error });
    return null;
  }
};

export default getMemberPaymentDetails;

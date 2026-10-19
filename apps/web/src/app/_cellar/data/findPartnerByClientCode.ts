import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerClientCodes } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * The partner a reference belongs to, when a search is one
 *
 * Lets staff type the code printed on a case (PC-1001) into a stock search and
 * get that owner's wine. Spaces and case are forgiven: "pc 1001" works.
 *
 * Never throws: with no references table yet, a search simply finds nothing
 * by code.
 *
 * @example
 *   await findPartnerByClientCode('pc-1001'); // '4bd630d6-…'
 *
 * @param text - What was typed into the search
 * @returns The partner id, or null when the text is not a known reference
 */
const findPartnerByClientCode = async (text: string) => {
  const match = /^\s*pc[\s-]*(\d{3,6})\s*$/i.exec(text);
  if (!match) return null;

  try {
    const [row] = await db
      .select({ partnerId: partnerClientCodes.partnerId })
      .from(partnerClientCodes)
      .where(eq(partnerClientCodes.code, `PC-${match[1]}`))
      .limit(1);
    return row?.partnerId ?? null;
  } catch (error) {
    logger.error('Could not look up a member reference', { error });
    return null;
  }
};

export default findPartnerByClientCode;

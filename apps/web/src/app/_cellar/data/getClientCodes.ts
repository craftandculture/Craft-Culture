import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { partnerClientCodes } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * Private cellar member references, by partner
 *
 * Never throws: before the migration has run there are no references, and a
 * screen that shows them shows none rather than failing.
 *
 * @param partnerIds - Limit to these partners; omit for every reference
 * @returns A map of partner id to reference
 */
const getClientCodes = async (partnerIds?: string[]) => {
  if (partnerIds && partnerIds.length === 0) return new Map<string, string>();

  try {
    const rows = await db
      .select({ partnerId: partnerClientCodes.partnerId, code: partnerClientCodes.code })
      .from(partnerClientCodes)
      .where(partnerIds ? inArray(partnerClientCodes.partnerId, partnerIds) : undefined);

    return new Map(rows.map((row) => [row.partnerId, row.code]));
  } catch (error) {
    logger.error('Could not read member references', { error });
    return new Map<string, string>();
  }
};

export default getClientCodes;

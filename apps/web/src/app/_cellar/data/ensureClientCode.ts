import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partnerClientCodes } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * A member's reference, issuing the next one if they have none yet
 *
 * Members existing when references began were numbered by the migration;
 * anyone joining later gets theirs the first time it is needed. The insert
 * ignores a clash, so two requests at once still leave one reference.
 *
 * Never throws: with no references table yet the member is shown none.
 *
 * @param partnerId - The member's partner record
 * @returns The reference, such as 'PC-1007', or null
 */
const ensureClientCode = async (partnerId: string) => {
  try {
    const read = async () =>
      (
        await db
          .select({ code: partnerClientCodes.code })
          .from(partnerClientCodes)
          .where(eq(partnerClientCodes.partnerId, partnerId))
          .limit(1)
      )[0]?.code ?? null;

    const existing = await read();
    if (existing) return existing;

    await db
      .insert(partnerClientCodes)
      .values({ partnerId, code: sql`'PC-' || nextval('partner_client_code_seq')` })
      .onConflictDoNothing({ target: partnerClientCodes.partnerId });

    return await read();
  } catch (error) {
    logger.error('Could not issue a member reference', { partnerId, error });
    return null;
  }
};

export default ensureClientCode;

import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarAccessGrants } from '@/database/schema';

import getPartnerUserIds from './getPartnerUserIds';

/**
 * The people who hold a cellar, without anyone it is shared with
 *
 * For notices meant for the holder alone — that someone they gave access to
 * has acted, or has accepted. Sending those to every delegate too would tell
 * a PA that the spouse had just bought wine.
 *
 * @param partnerId - The cellar
 * @returns Distinct user ids
 */
const getCellarHolderIds = async (partnerId: string) => {
  const everyone = await getPartnerUserIds(partnerId);

  const delegates = await db
    .select({ userId: cellarAccessGrants.userId })
    .from(cellarAccessGrants)
    .where(
      and(
        eq(cellarAccessGrants.partnerId, partnerId),
        eq(cellarAccessGrants.status, 'active'),
      ),
    );

  const delegateIds = new Set(delegates.map((row) => row.userId));

  return everyone.filter((userId) => !delegateIds.has(userId));
};

export default getCellarHolderIds;

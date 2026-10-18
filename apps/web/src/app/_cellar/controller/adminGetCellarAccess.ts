import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { cellarAccessGrants, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Everyone given shared access to a member's cellar, across all members
 *
 * Staff only. Guarded: a missing table reads as nobody sharing.
 *
 * @example
 *   const { people } = await trpcClient.cellar.admin.getAccess.query();
 */
const adminGetCellarAccess = staffAdminProcedure.query(async () => {
  try {
    const people = await db
      .select({
        id: cellarAccessGrants.id,
        partnerId: cellarAccessGrants.partnerId,
        holderName: partners.businessName,
        name: cellarAccessGrants.name,
        email: cellarAccessGrants.email,
        role: cellarAccessGrants.role,
        status: cellarAccessGrants.status,
        expiresAt: cellarAccessGrants.expiresAt,
        acceptedAt: cellarAccessGrants.acceptedAt,
        createdAt: cellarAccessGrants.createdAt,
      })
      .from(cellarAccessGrants)
      .innerJoin(partners, eq(partners.id, cellarAccessGrants.partnerId))
      .where(inArray(cellarAccessGrants.status, ['invited', 'active']))
      .orderBy(desc(cellarAccessGrants.createdAt));

    return { people };
  } catch (error) {
    logger.error('Could not read shared cellar access', { error });
    return { people: [] };
  }
});

export default adminGetCellarAccess;

import { and, asc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * The partner record that is Craft & Culture itself
 *
 * The oldest active partner named "Craft & Culture" that is not a private
 * collector's record: the same record new Private Cellar orders are raised
 * under (see `resolveOrderPartnerId`).
 *
 * @returns C&C's partner id, or null when there is none
 */
const getCraftCulturePartnerId = async () => {
  const [craftCulture] = await db
    .select({ id: partners.id, type: partners.type })
    .from(partners)
    .where(
      and(
        sql`lower(trim(${partners.businessName})) = 'craft & culture'`,
        eq(partners.status, 'active'),
      ),
    )
    .orderBy(asc(partners.createdAt))
    .limit(1);

  if (!craftCulture || craftCulture.type === 'private_collector') return null;

  return craftCulture.id;
};

export default getCraftCulturePartnerId;

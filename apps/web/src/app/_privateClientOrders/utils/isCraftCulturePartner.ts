import { and, asc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * Whether an order's partner record is Craft & Culture itself
 *
 * C&C places some orders as its own partner (every Private Cellar order is
 * raised under C&C), and those skip the partner's verification step. The name
 * alone decided that before, so any account renamed "Craft & Culture" would
 * have skipped it too. Now it must be the one record that is C&C: the oldest
 * active partner of that name, which is the same record new Private Cellar
 * orders are raised under (see `resolveOrderPartnerId`), and never a private
 * collector's record. Anything else goes through verification as normal.
 *
 * @param partnerId - The order's partner
 * @returns True only for C&C's own partner record
 */
const isCraftCulturePartner = async (partnerId: string | null) => {
  if (!partnerId) return false;

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

  return (
    craftCulture?.id === partnerId && craftCulture.type !== 'private_collector'
  );
};

export default isCraftCulturePartner;

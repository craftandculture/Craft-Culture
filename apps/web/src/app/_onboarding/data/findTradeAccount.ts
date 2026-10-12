import { and, eq, ne, or } from 'drizzle-orm';

import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';

/**
 * The business account an email already belongs to, if any
 *
 * One login sees one account. A trade user who also joined Private Cellar
 * would be shown the business stock in place of their cellar, and joining
 * would rewrite the account's name and customer type. So a private cellar
 * needs an email of its own: staff, and anyone linked to a partner that is
 * not a private collector, are turned away from /join.
 *
 * @param userId - The signed-in user
 * @returns The business's name, or null if the email is free to join
 */
const findTradeAccount = async (userId: string) => {
  const [user] = await db
    .select({ role: users.role, partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.role === 'admin' || user?.role === 'wms_operator') return 'Craft & Culture staff';

  const [linked] = await db
    .select({ name: partners.businessName })
    .from(partners)
    .leftJoin(partnerMembers, eq(partnerMembers.partnerId, partners.id))
    .where(
      and(
        ne(partners.type, 'private_collector'),
        or(
          eq(partnerMembers.userId, userId),
          eq(partners.userId, userId),
          ...(user?.partnerId ? [eq(partners.id, user.partnerId)] : []),
        ),
      ),
    )
    .limit(1);

  return linked?.name ?? null;
};

export default findTradeAccount;

import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';

/**
 * The C&C staff who hear about Private Cellar work
 *
 * Admins signed in with a C&C address. Role alone would include partners who
 * hold admin logins, and these notifications carry members' names, orders and
 * money.
 *
 * @returns User ids of staff admins
 */
const getCellarStaffIds = async () => {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, 'admin'),
        sql`lower(${users.email}) LIKE '%@craftculture.xyz'`,
      ),
    );

  return rows.map((row) => row.id);
};

export default getCellarStaffIds;

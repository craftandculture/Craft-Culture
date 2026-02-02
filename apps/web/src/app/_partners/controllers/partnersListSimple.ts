import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a simple list of all active partners for dropdowns
 *
 * Returns only id and name for each partner, suitable for select/dropdown components.
 * Only returns active partners (excludes inactive and suspended).
 */
const partnersListSimple = adminProcedure.query(async () => {
  const partnersList = await db
    .select({
      id: partners.id,
      name: partners.businessName,
      type: partners.type,
    })
    .from(partners)
    .where(eq(partners.status, 'active'))
    .orderBy(partners.businessName);

  return partnersList;
});

export default partnersListSimple;

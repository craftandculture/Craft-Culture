import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all active wine partner partners
 *
 * Returns a list of all active partners with type 'wine_partner' for assignment.
 * Excludes inactive and suspended partners.
 */
const partnersGetWinePartners = adminProcedure.query(async () => {
  const winePartners = await db
    .select({
      id: partners.id,
      businessName: partners.businessName,
      status: partners.status,
    })
    .from(partners)
    .where(
      and(eq(partners.type, 'wine_partner'), eq(partners.status, 'active')),
    )
    .orderBy(partners.businessName);

  return winePartners;
});

export default partnersGetWinePartners;

import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all wine partner partners
 *
 * Returns a list of all partners with type 'wine_partner' for assignment.
 */
const partnersGetWinePartners = adminProcedure.query(async () => {
  const winePartners = await db
    .select({
      id: partners.id,
      businessName: partners.businessName,
      status: partners.status,
    })
    .from(partners)
    .where(eq(partners.type, 'wine_partner'))
    .orderBy(partners.businessName);

  return winePartners;
});

export default partnersGetWinePartners;

import { and, eq, inArray } from 'drizzle-orm';

import { STOCK_OWNER_PARTNER_TYPES } from '@/app/_auth/constants/accessProfiles';
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
      /*
        Both stock-owning types, not wine partners alone.

        This list populates the partner assignment dropdown on the users
        screen. Filtered to wine_partner, a collector could never be assigned a
        login — and reclassifying an assigned partner made them vanish from the
        control that had just been used to assign them.
      */
      and(
        inArray(partners.type, [...STOCK_OWNER_PARTNER_TYPES]),
        eq(partners.status, 'active'),
      ),
    )
    .orderBy(partners.businessName);

  return winePartners;
});

export default partnersGetWinePartners;

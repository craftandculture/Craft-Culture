import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * The wine partners behind a distributor's orders, by partner id
 *
 * The distributor needs to know whose client each order is (Cru, C&C, ...)
 * to handle it, so the partner's name and logo are shown. Their prices,
 * contacts and staff are not (see distributorOrderView and
 * counterpartySafeActivity). Kevin, 29 Oct 2026, reversing 7b7134a7.
 *
 * @example
 *   const views = await distributorPartnerView(rows.map((r) => r.order.partnerId));
 *   views.get(order.partnerId); // { id, businessName: 'Cru Wine', logoUrl }
 *
 * @param partnerIds - The orders' partners
 * @returns Name and logo for each partner found
 */
const distributorPartnerView = async (partnerIds: (string | null)[]) => {
  const ids = [...new Set(partnerIds.filter((id): id is string => !!id))];
  const rows = ids.length
    ? await db
        .select({ id: partners.id, businessName: partners.businessName, logoUrl: partners.logoUrl })
        .from(partners)
        .where(inArray(partners.id, ids))
    : [];
  return new Map(rows.map((row) => [row.id, row]));
};

export default distributorPartnerView;

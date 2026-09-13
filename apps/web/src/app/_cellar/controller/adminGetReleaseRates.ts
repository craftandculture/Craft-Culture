import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Every release rate card, with the member each belongs to
 *
 * The row with no partner is the house default; it sorts first because it is
 * the one that applies until somebody decides otherwise.
 */
const adminGetReleaseRates = adminProcedure.query(async () => {
  const rows = await db
    .select({
      rate: cellarReleaseRates,
      partnerName: partners.businessName,
    })
    .from(cellarReleaseRates)
    .leftJoin(partners, eq(partners.id, cellarReleaseRates.partnerId));

  return {
    rates: rows
      .map((row) => ({ ...row.rate, partnerName: row.partnerName }))
      .sort((a, b) => {
        if (!a.partnerId) return -1;
        if (!b.partnerId) return 1;
        return (a.partnerName ?? '').localeCompare(b.partnerName ?? '');
      }),
  };
});

export default adminGetReleaseRates;

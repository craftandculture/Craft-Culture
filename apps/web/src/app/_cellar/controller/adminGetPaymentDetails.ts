import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarPaymentSettings } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/** The bank details members are shown when paying for wine, for editing */
const adminGetPaymentDetails = staffAdminProcedure.query(async () => {
  const [row] = await db
    .select()
    .from(cellarPaymentSettings)
    .where(eq(cellarPaymentSettings.id, 'house'))
    .limit(1);

  return { details: row?.details ?? null, updatedAt: row?.updatedAt ?? null };
});

export default adminGetPaymentDetails;

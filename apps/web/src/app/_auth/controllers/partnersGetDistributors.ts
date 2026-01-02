import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all distributor partners
 *
 * Returns a list of all partners with type 'distributor' for assignment.
 */
const partnersGetDistributors = adminProcedure.query(async () => {
  const distributors = await db
    .select({
      id: partners.id,
      businessName: partners.businessName,
      status: partners.status,
    })
    .from(partners)
    .where(eq(partners.type, 'distributor'))
    .orderBy(partners.businessName);

  return distributors;
});

export default partnersGetDistributors;

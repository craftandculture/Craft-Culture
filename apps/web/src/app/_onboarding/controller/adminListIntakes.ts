import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarIntakes, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Every wine source members have told us about, newest first
 *
 * Intakes on an application that has not been approved yet have no member
 * cellar to land in and are listed under the applicant's name on
 * Applications instead.
 */
const adminListIntakes = adminProcedure.query(async () =>
  db
    .select({ intake: cellarIntakes, memberName: partners.businessName, memberStatus: partners.status })
    .from(cellarIntakes)
    .innerJoin(partners, eq(partners.id, cellarIntakes.partnerId))
    .where(eq(partners.status, 'active'))
    .orderBy(desc(cellarIntakes.createdAt)),
);

export default adminListIntakes;

import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * The distributors a dispatch can be sent to
 *
 * The dispatch wizard read these from the partners list, which is admin-only,
 * so on the warehouse login the list came back empty and no dispatch could be
 * closed. The warehouse team can dispatch, so it can see who to dispatch to.
 */
const adminGetDispatchDistributors = wmsOperatorProcedure.query(async () =>
  db
    .select({
      id: partners.id,
      name: partners.businessName,
      logoUrl: partners.logoUrl,
    })
    .from(partners)
    .where(and(eq(partners.status, 'active'), eq(partners.type, 'distributor')))
    .orderBy(partners.businessName),
);

export default adminGetDispatchDistributors;

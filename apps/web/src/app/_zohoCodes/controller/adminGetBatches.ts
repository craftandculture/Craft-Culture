import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { zohoItemChanges } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Recent cleanup batches, newest first, with what each changed
 */
const adminGetBatches = adminProcedure.query(async () =>
  db
    .select({
      batchId: zohoItemChanges.batchId,
      startedAt: sql<Date>`min(${zohoItemChanges.createdAt})`,
      created: sql<number>`count(*) filter (where ${zohoItemChanges.action} = 'create')::int`,
      inactivated: sql<number>`count(*) filter (where ${zohoItemChanges.action} = 'inactivate')::int`,
      customs: sql<number>`count(*) filter (where ${zohoItemChanges.action} = 'set_customs')::int`,
      skipped: sql<number>`count(*) filter (where ${zohoItemChanges.action} = 'skipped')::int`,
      live: sql<number>`count(*) filter (where ${zohoItemChanges.undoneAt} is null)::int`,
    })
    .from(zohoItemChanges)
    .groupBy(zohoItemChanges.batchId)
    .orderBy(desc(sql`min(${zohoItemChanges.createdAt})`))
    .limit(20),
);

export default adminGetBatches;

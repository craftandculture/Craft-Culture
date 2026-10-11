import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoItemChanges } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Everything one cleanup batch did, in order: each item retired or created,
 * and each one skipped with the reason
 */
const adminGetBatchChanges = adminProcedure
  .input(z.object({ batchId: z.string().uuid() }))
  .query(async ({ input }) =>
    db
      .select({
        id: zohoItemChanges.id,
        zohoItemId: zohoItemChanges.zohoItemId,
        action: zohoItemChanges.action,
        itemName: zohoItemChanges.itemName,
        beforeName: zohoItemChanges.beforeName,
        afterName: zohoItemChanges.afterName,
        beforeSku: zohoItemChanges.beforeSku,
        afterSku: zohoItemChanges.afterSku,
        reason: zohoItemChanges.reason,
        undoneAt: zohoItemChanges.undoneAt,
        createdAt: zohoItemChanges.createdAt,
      })
      .from(zohoItemChanges)
      .where(eq(zohoItemChanges.batchId, input.batchId))
      .orderBy(asc(zohoItemChanges.createdAt)),
  );

export default adminGetBatchChanges;

import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsCaseLabels } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Mark case labels as printed
 *
 * @example
 *   await trpcClient.wms.admin.labels.markPrinted.mutate({ labelIds: ["uuid1", "uuid2"] });
 */
const adminMarkLabelsPrinted = adminProcedure
  .input(z.object({ labelIds: z.array(z.string().uuid()).min(1) }))
  .mutation(async ({ input }) => {
    await db
      .update(wmsCaseLabels)
      .set({
        printedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(wmsCaseLabels.id, input.labelIds));

    return { success: true, count: input.labelIds.length };
  });

export default adminMarkLabelsPrinted;

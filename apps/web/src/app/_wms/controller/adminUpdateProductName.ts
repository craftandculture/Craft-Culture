import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsCaseLabels, wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Update product name (and optionally producer) across all WMS records for a given LWIN18.
 * Updates wmsStock, wmsCaseLabels, and wmsStockMovements for full consistency.
 *
 * @example
 *   await trpcClient.wms.admin.stock.updateProductName.mutate({
 *     lwin18: '1010279-2015-06-00750',
 *     productName: 'Chateau Margaux 2015',
 *     producer: 'Chateau Margaux',
 *   });
 */
const adminUpdateProductName = adminProcedure
  .input(
    z.object({
      lwin18: z.string().min(1),
      productName: z.string().min(1),
      producer: z.string().nullable().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const { lwin18, productName, producer } = input;

    // Update all three tables in parallel for the given LWIN18
    await Promise.all([
      db
        .update(wmsStock)
        .set({
          productName,
          ...(producer !== undefined ? { producer } : {}),
        })
        .where(eq(wmsStock.lwin18, lwin18)),

      db
        .update(wmsCaseLabels)
        .set({ productName })
        .where(eq(wmsCaseLabels.lwin18, lwin18)),

      db
        .update(wmsStockMovements)
        .set({ productName })
        .where(eq(wmsStockMovements.lwin18, lwin18)),
    ]);

    return { success: true };
  });

export default adminUpdateProductName;

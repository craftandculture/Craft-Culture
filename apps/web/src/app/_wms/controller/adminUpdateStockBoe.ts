import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Update the Re-Export BOE number on a stock record
 *
 * @param stockId - The stock record UUID
 * @param reExportBoeNumber - The Re-Export BOE number to set
 */
const adminUpdateStockBoe = wmsOperatorProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      reExportBoeNumber: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    const { stockId, reExportBoeNumber } = input;

    const [updated] = await db
      .update(wmsStock)
      .set({ reExportBoeNumber: reExportBoeNumber || null })
      .where(eq(wmsStock.id, stockId))
      .returning({ id: wmsStock.id });

    return updated;
  });

export default adminUpdateStockBoe;

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsReceivingDrafts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Delete a receiving draft after receiving is completed
 *
 * @example
 *   await trpcClient.wms.admin.receiving.deleteDraft.mutate({ shipmentId: 'uuid' });
 */
const adminDeleteReceivingDraft = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    await db.delete(wmsReceivingDrafts).where(eq(wmsReceivingDrafts.shipmentId, input.shipmentId));

    return { success: true };
  });

export default adminDeleteReceivingDraft;

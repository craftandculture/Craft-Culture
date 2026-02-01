import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { users, wmsReceivingDrafts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get the receiving draft for a shipment (if one exists)
 *
 * Returns the saved draft state so receiving can be resumed
 *
 * @example
 *   await trpcClient.wms.admin.receiving.getDraft.query({ shipmentId: 'uuid' });
 */
const adminGetReceivingDraft = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .query(async ({ input }) => {
    const [draft] = await db
      .select({
        id: wmsReceivingDrafts.id,
        shipmentId: wmsReceivingDrafts.shipmentId,
        items: wmsReceivingDrafts.items,
        notes: wmsReceivingDrafts.notes,
        status: wmsReceivingDrafts.status,
        lastModifiedAt: wmsReceivingDrafts.lastModifiedAt,
        lastModifiedByName: users.name,
      })
      .from(wmsReceivingDrafts)
      .leftJoin(users, eq(wmsReceivingDrafts.lastModifiedBy, users.id))
      .where(eq(wmsReceivingDrafts.shipmentId, input.shipmentId));

    if (!draft) {
      return null;
    }

    return draft;
  });

export default adminGetReceivingDraft;

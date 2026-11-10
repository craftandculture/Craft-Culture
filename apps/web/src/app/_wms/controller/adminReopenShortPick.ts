import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPickListItems, wmsPickLists, zohoSalesOrders } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import splitShortPick from '../utils/splitShortPick';

/**
 * Put back on a pick list the part of a line that was closed short
 *
 * Until short picks kept their remainder open, a line picked for less than it
 * asked was closed, and the list could be completed with cases still booked on
 * the shelf. Where those cases did leave with the order, this reopens the list
 * with the missing quantity as a new line, so it can be picked from the bay the
 * system still shows it in and the list completed again.
 *
 * Preview first (`dryRun`), then save.
 *
 * @example
 *   await trpcClient.wms.admin.picking.reopenShortPick.mutate({
 *     pickListItemId, dryRun: false,
 *   });
 */
const adminReopenShortPick = staffAdminProcedure
  .input(
    z.object({
      pickListItemId: z.string().uuid(),
      dryRun: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) =>
    db.transaction(async (tx) => {
      const [line] = await tx
        .select()
        .from(wmsPickListItems)
        .where(eq(wmsPickListItems.id, input.pickListItemId))
        .for('update');

      if (!line?.isPicked || line.pickedQuantity == null) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That line has not been picked.' });
      }

      // Only a finished list goes back to work: a cancelled one, or one whose
      // order has already been dispatched, must not reappear on the scanner.
      const [list] = await tx
        .select({ status: wmsPickLists.status, orderId: wmsPickLists.orderId })
        .from(wmsPickLists)
        .where(eq(wmsPickLists.id, line.pickListId));
      const [order] = list?.orderId
        ? await tx
            .select({ dispatchBatchId: zohoSalesOrders.dispatchBatchId })
            .from(zohoSalesOrders)
            .where(eq(zohoSalesOrders.id, list.orderId))
        : [];
      if (list?.status !== 'completed' || order?.dispatchBatchId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only a completed pick list that has not been dispatched can be reopened.',
        });
      }

      const wanted = line.quantityBottles ?? line.quantityCases;
      if (line.pickedQuantity >= wanted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That line was picked in full.' });
      }

      const summary = {
        dryRun: input.dryRun,
        productName: line.productName,
        picked: line.pickedQuantity,
        wanted,
        reopened: wanted - line.pickedQuantity,
      };

      if (input.dryRun) return { ...summary, remainderLineId: null };

      const remainder = await splitShortPick({ line, picked: line.pickedQuantity, db: tx });

      await tx
        .update(wmsPickLists)
        .set({ status: 'in_progress', completedAt: null, completedBy: null, updatedAt: new Date() })
        .where(eq(wmsPickLists.id, line.pickListId));

      return { ...summary, remainderLineId: remainder?.id ?? null };
    }),
  );

export default adminReopenShortPick;

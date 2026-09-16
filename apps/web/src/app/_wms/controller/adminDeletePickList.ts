/**
 * Delete a Pick List
 *
 * Deletes a pick list and its items. Also resets the associated
 * Zoho sales order status back to 'synced' so it can be re-released.
 */

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPickListItems, wmsPickLists, zohoSalesOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import releaseStockReservations from '../utils/releaseStockReservations';

const adminDeletePickList = wmsOperatorProcedure
  .input(z.object({ pickListId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { pickListId } = input;

    // Get the pick list
    const [pickList] = await db
      .select()
      .from(wmsPickLists)
      .where(eq(wmsPickLists.id, pickListId));

    if (!pickList) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list not found',
      });
    }

    // Don't allow deleting completed pick lists
    if (pickList.status === 'completed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete a completed pick list',
      });
    }

    /*
      Hand the held cases back before the pick list goes.

      Releasing to pick reserves the stock it promises — reservedCases up,
      availableCases down. Deleting the list without undoing that stranded the
      hold forever: the order went back to 'synced' and could be re-released,
      taking a second hold on the same wine, while the first was left with
      nothing pointing at it. Repeat that a few times and the shelf reads "Out"
      with cases physically in the bay, which is exactly what we were seeing.

      Only ever releases what this order still actively holds, so cases already
      converted to a pick are untouched.
    */
    if (pickList.orderId) {
      await releaseStockReservations({
        orderId: pickList.orderId,
        orderType: 'zoho',
        reason: `Pick list ${pickList.pickListNumber} deleted`,
        db,
      });
    }

    // IMPORTANT: Clear FK reference FIRST before deleting pick list
    // Reset the Zoho sales order if linked
    if (pickList.orderId) {
      await db
        .update(zohoSalesOrders)
        .set({
          pickListId: null,
          status: 'synced',
          updatedAt: new Date(),
        })
        .where(eq(zohoSalesOrders.id, pickList.orderId));
    }

    // Delete pick list items
    await db
      .delete(wmsPickListItems)
      .where(eq(wmsPickListItems.pickListId, pickListId));

    // Delete the pick list
    await db.delete(wmsPickLists).where(eq(wmsPickLists.id, pickListId));

    return {
      success: true,
      message: `Pick list ${pickList.pickListNumber} deleted`,
    };
  });

export default adminDeletePickList;

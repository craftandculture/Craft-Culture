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
import { adminProcedure } from '@/lib/trpc/procedures';

const adminDeletePickList = adminProcedure
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

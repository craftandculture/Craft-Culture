import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPickListItems, wmsPickLists, zohoSalesOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { completePickListSchema } from '../schemas/pickListSchema';
import releaseStockReservations from '../utils/releaseStockReservations';


/**
 * Complete a pick list
 * Validates all items are picked before completion
 *
 * @example
 *   await trpcClient.wms.admin.picking.complete.mutate({
 *     pickListId: "uuid"
 *   });
 */
const adminCompletePickList = wmsOperatorProcedure
  .input(completePickListSchema)
  .mutation(async ({ input, ctx }) => {
    const { pickListId, notes } = input;

    // Get pick list
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

    if (pickList.status === 'completed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pick list already completed',
      });
    }

    if (pickList.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot complete a cancelled pick list',
      });
    }

    // Check all items are picked
    const items = await db
      .select()
      .from(wmsPickListItems)
      .where(eq(wmsPickListItems.pickListId, pickListId));

    const unPickedItems = items.filter((i) => !i.isPicked);

    if (unPickedItems.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot complete: ${unPickedItems.length} items still need to be picked`,
      });
    }

    // Complete the pick list
    const [completed] = await db
      .update(wmsPickLists)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: ctx.user.id,
        notes: notes ? (pickList.notes ? `${pickList.notes}\n${notes}` : notes) : pickList.notes,
        updatedAt: new Date(),
      })
      .where(eq(wmsPickLists.id, pickListId))
      .returning();

    /*
      Hand back anything this order still holds.

      Picking converts the reservation on the bay it picked FROM. Release puts
      the hold on the bay it expected to pick from, and those need not be the
      same: the picker walks to another bay because that one was empty, short,
      or closer. The original hold is then never converted, and once the list
      is complete nothing will ever convert it — the cases sit reserved against
      an order that has already shipped.

      Every line is picked by this point (guarded above), so whatever is still
      active is a leftover, not a promise.
    */
    if (pickList.orderId) {
      await releaseStockReservations({
        orderId: pickList.orderId,
        orderType: 'zoho',
        reason: `Pick list ${pickList.pickListNumber} completed`,
        db,
      });
    }

    // Update linked Zoho Sales Order status to 'picked' if this is a Zoho order
    if (pickList.orderId) {
      await db
        .update(zohoSalesOrders)
        .set({
          status: 'picked',
          updatedAt: new Date(),
        })
        .where(eq(zohoSalesOrders.id, pickList.orderId));
    }

    return {
      success: true,
      pickList: completed,
      message: `Pick list ${pickList.pickListNumber} completed`,
    };
  });

export default adminCompletePickList;

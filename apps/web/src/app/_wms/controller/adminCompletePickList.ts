import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPickListItems, wmsPickLists } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { completePickListSchema } from '../schemas/pickListSchema';

/**
 * Complete a pick list
 * Validates all items are picked before completion
 *
 * @example
 *   await trpcClient.wms.admin.picking.complete.mutate({
 *     pickListId: "uuid"
 *   });
 */
const adminCompletePickList = adminProcedure
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
        completedBy: ctx.session.user.id,
        notes: notes ? (pickList.notes ? `${pickList.notes}\n${notes}` : notes) : pickList.notes,
        updatedAt: new Date(),
      })
      .where(eq(wmsPickLists.id, pickListId))
      .returning();

    return {
      success: true,
      pickList: completed,
      message: `Pick list ${pickList.pickListNumber} completed`,
    };
  });

export default adminCompletePickList;

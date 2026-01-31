import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPickLists } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { assignPickListSchema } from '../schemas/pickListSchema';

/**
 * Assign a pick list to a user or unassign
 *
 * @example
 *   await trpcClient.wms.admin.picking.assign.mutate({
 *     pickListId: "uuid",
 *     assignedTo: "user-uuid"
 *   });
 */
const adminAssignPickList = adminProcedure
  .input(assignPickListSchema)
  .mutation(async ({ input }) => {
    const { pickListId, assignedTo } = input;

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

    if (pickList.status === 'completed' || pickList.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot assign a ${pickList.status} pick list`,
      });
    }

    // Update assignment
    const [updated] = await db
      .update(wmsPickLists)
      .set({
        assignedTo: assignedTo ?? null,
        updatedAt: new Date(),
      })
      .where(eq(wmsPickLists.id, pickListId))
      .returning();

    return {
      success: true,
      pickList: updated,
      message: assignedTo
        ? `Pick list assigned successfully`
        : `Pick list unassigned`,
    };
  });

export default adminAssignPickList;

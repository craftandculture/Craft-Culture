import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsLocations, wmsPickListItems, wmsPickLists } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPickListSchema } from '../schemas/pickListSchema';

/**
 * Get a single pick list with items and location details
 *
 * @example
 *   await trpcClient.wms.admin.picking.getOne.query({ pickListId: "uuid" });
 */
const adminGetPickList = adminProcedure
  .input(getPickListSchema)
  .query(async ({ input }) => {
    const { pickListId } = input;

    // Get pick list with assignee info
    const [pickList] = await db
      .select({
        id: wmsPickLists.id,
        pickListNumber: wmsPickLists.pickListNumber,
        status: wmsPickLists.status,
        orderId: wmsPickLists.orderId,
        orderNumber: wmsPickLists.orderNumber,
        totalItems: wmsPickLists.totalItems,
        pickedItems: wmsPickLists.pickedItems,
        assignedTo: wmsPickLists.assignedTo,
        assignedToName: users.name,
        startedAt: wmsPickLists.startedAt,
        completedAt: wmsPickLists.completedAt,
        completedBy: wmsPickLists.completedBy,
        notes: wmsPickLists.notes,
        createdAt: wmsPickLists.createdAt,
      })
      .from(wmsPickLists)
      .leftJoin(users, eq(wmsPickLists.assignedTo, users.id))
      .where(eq(wmsPickLists.id, pickListId));

    if (!pickList) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list not found',
      });
    }

    // Get pick list items with location details
    const items = await db
      .select({
        id: wmsPickListItems.id,
        lwin18: wmsPickListItems.lwin18,
        productName: wmsPickListItems.productName,
        quantityCases: wmsPickListItems.quantityCases,
        suggestedLocationId: wmsPickListItems.suggestedLocationId,
        suggestedLocationCode: wmsLocations.locationCode,
        pickedFromLocationId: wmsPickListItems.pickedFromLocationId,
        pickedQuantity: wmsPickListItems.pickedQuantity,
        pickedAt: wmsPickListItems.pickedAt,
        pickedBy: wmsPickListItems.pickedBy,
        isPicked: wmsPickListItems.isPicked,
        notes: wmsPickListItems.notes,
      })
      .from(wmsPickListItems)
      .leftJoin(wmsLocations, eq(wmsPickListItems.suggestedLocationId, wmsLocations.id))
      .where(eq(wmsPickListItems.pickListId, pickListId));

    // Calculate progress
    const totalToPick = items.reduce((sum, i) => sum + i.quantityCases, 0);
    const totalPicked = items.reduce((sum, i) => sum + (i.pickedQuantity ?? 0), 0);
    const progressPercent = totalToPick > 0 ? Math.round((totalPicked / totalToPick) * 100) : 0;

    return {
      ...pickList,
      items,
      progress: {
        totalItems: items.length,
        pickedItems: items.filter((i) => i.isPicked).length,
        totalCases: totalToPick,
        pickedCases: totalPicked,
        percent: progressPercent,
      },
    };
  });

export default adminGetPickList;

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { pickItemSchema } from '../schemas/pickListSchema';
import convertReservationToPick from '../utils/convertReservationToPick';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Mark a pick list item as picked and update stock
 * Records a movement and decrements available stock
 *
 * @example
 *   await trpcClient.wms.admin.picking.pickItem.mutate({
 *     pickListItemId: "uuid",
 *     pickedFromLocationId: "location-uuid",
 *     pickedQuantity: 5
 *   });
 */
const adminPickItem = adminProcedure
  .input(pickItemSchema)
  .mutation(async ({ input, ctx }) => {
    const { pickListItemId, pickedFromLocationId, pickedQuantity, notes } = input;

    // Get user ID from context (adminProcedure guarantees ctx.user exists)
    const userId = ctx.user.id;

    // Get pick list item
    const [pickListItem] = await db
      .select({
        id: wmsPickListItems.id,
        pickListId: wmsPickListItems.pickListId,
        lwin18: wmsPickListItems.lwin18,
        productName: wmsPickListItems.productName,
        quantityCases: wmsPickListItems.quantityCases,
        isPicked: wmsPickListItems.isPicked,
      })
      .from(wmsPickListItems)
      .where(eq(wmsPickListItems.id, pickListItemId));

    if (!pickListItem) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list item not found',
      });
    }

    if (pickListItem.isPicked) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Item already picked',
      });
    }

    // Get the pick list
    const [pickList] = await db
      .select()
      .from(wmsPickLists)
      .where(eq(wmsPickLists.id, pickListItem.pickListId));

    if (!pickList) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list not found',
      });
    }

    if (pickList.status === 'completed' || pickList.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot pick from a ${pickList.status} pick list`,
      });
    }

    // Verify location exists
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, pickedFromLocationId));

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    // Find stock at location for this specific product
    const [stock] = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, pickedFromLocationId),
          eq(wmsStock.lwin18, pickListItem.lwin18),
        ),
      );

    // Stock must exist at this location
    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No stock found at this location for ${pickListItem.productName}`,
      });
    }

    // Validate stock availability
    if (stock.availableCases < pickedQuantity) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient stock. Available: ${stock.availableCases}, requested: ${pickedQuantity}`,
      });
    }

    // Update pick list item
    const [updatedItem] = await db
      .update(wmsPickListItems)
      .set({
        pickedFromLocationId,
        pickedQuantity,
        pickedAt: new Date(),
        pickedBy: userId,
        isPicked: true,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(wmsPickListItems.id, pickListItemId))
      .returning();

    // Update stock — reservation-aware decrement
    await convertReservationToPick({
      stockId: stock.id,
      orderId: pickList.orderId ?? '',
      quantityCases: pickedQuantity,
      db,
    });

    // Record movement
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'pick',
      lwin18: pickListItem.lwin18,
      productName: pickListItem.productName,
      quantityCases: pickedQuantity,
      fromLocationId: pickedFromLocationId,
      orderId: pickList.orderId,
      notes: `Pick list ${pickList.pickListNumber}`,
      performedBy: userId,
      performedAt: new Date(),
    });

    // Update pick list status and counts
    const newPickedCount = pickList.pickedItems + 1;
    const newStatus =
      pickList.status === 'pending' ? 'in_progress' : pickList.status;

    await db
      .update(wmsPickLists)
      .set({
        pickedItems: newPickedCount,
        status: newStatus,
        startedAt: pickList.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wmsPickLists.id, pickList.id));

    return {
      success: true,
      item: updatedItem,
      message: `Picked ${pickedQuantity} cases from ${location.locationCode}`,
    };
  });

export default adminPickItem;

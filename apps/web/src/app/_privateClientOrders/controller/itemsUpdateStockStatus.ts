import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrderItems,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const updateStockStatusSchema = z.object({
  itemId: z.string().uuid(),
  stockStatus: z.enum([
    'pending',
    'confirmed',
    'at_cc_bonded',
    'in_transit_to_cc',
    'at_distributor',
    'delivered',
  ]),
  stockExpectedAt: z.date().optional(),
  stockNotes: z.string().optional(),
});

/**
 * Update the stock status of a line item
 *
 * Admin procedure to track stock movement for individual line items.
 * Updates the stock status and optionally the expected arrival date and notes.
 * Logs the change for audit purposes.
 */
const itemsUpdateStockStatus = adminProcedure
  .input(updateStockStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { itemId, stockStatus, stockExpectedAt, stockNotes } = input;
    const { user } = ctx;

    // Fetch the item with its order
    const item = await db.query.privateClientOrderItems.findFirst({
      where: { id: itemId },
      with: {
        order: {
          columns: { id: true, status: true },
        },
      },
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Cannot update stock status for orders that are still in draft or cancelled
    const invalidStatuses = ['draft', 'cancelled'];
    if (invalidStatuses.includes(item.order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot update stock status for orders in draft or cancelled status',
      });
    }

    const previousStatus = item.stockStatus;

    // Build update data
    const updateData: {
      stockStatus: typeof stockStatus;
      stockExpectedAt?: Date | null;
      stockNotes?: string | null;
      stockConfirmedAt?: Date | null;
      updatedAt: Date;
    } = {
      stockStatus,
      updatedAt: new Date(),
    };

    // Set confirmed timestamp when status changes to confirmed
    if (stockStatus === 'confirmed' && previousStatus !== 'confirmed') {
      updateData.stockConfirmedAt = new Date();
    }

    // Update expected arrival date if provided
    if (stockExpectedAt !== undefined) {
      updateData.stockExpectedAt = stockExpectedAt;
    }

    // Update notes if provided
    if (stockNotes !== undefined) {
      updateData.stockNotes = stockNotes;
    }

    // Update the item
    const [updatedItem] = await db
      .update(privateClientOrderItems)
      .set(updateData)
      .where(eq(privateClientOrderItems.id, itemId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId: item.order.id,
      userId: user.id,
      action: 'stock_status_updated',
      notes: stockNotes,
      metadata: {
        itemId,
        productName: item.productName,
        previousStockStatus: previousStatus,
        newStockStatus: stockStatus,
        stockExpectedAt: stockExpectedAt?.toISOString(),
      },
    });

    return updatedItem;
  });

export default itemsUpdateStockStatus;

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import { privateClientOrderItems } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { CLAIM } from '../utils/planZohoSalesOrder';
import recalculateOrderTotals from '../utils/recalculateOrderTotals';
import repairZohoItemCode from '../utils/repairZohoItemCode';
import saleLwin18Of from '../utils/saleLwin18Of';

const adminUpdateItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
  pricePerCaseUsd: z.number().positive().optional(),
  productName: z.string().min(1).optional(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  notes: z.string().optional(),
  /*
    The wine's code, set by C&C. Partners order from a catalogue whose keys are
    not LWINs, so their lines arrive without one; this is where it is given.
    Held as the pack the line is cased in — the sales order recomposes the
    pack it sells from the line's case size.
  */
  lwin: z
    .string()
    .trim()
    .refine(isUsableLwin18, {
      message: 'Not a LWIN18 — expected e.g. 1012781-2014-06-00750',
    })
    .transform(normalizeLwin18)
    .optional(),
});

// Statuses where admin cannot edit (final statuses)
const NON_EDITABLE_STATUSES = ['delivered', 'cancelled'];

/**
 * Admin update a line item in a private client order
 *
 * Admins can update items in any order except delivered or cancelled orders.
 */
const adminUpdateItem = wmsOperatorProcedure
  .input(adminUpdateItemSchema)
  .mutation(async ({ input }) => {
    const { itemId, quantity, pricePerCaseUsd, productName, producer, vintage, notes, lwin } =
      input;

    // Fetch the item with its order
    const item = await db.query.privateClientOrderItems.findFirst({
      where: { id: itemId },
      with: {
        order: {
          columns: { id: true, status: true, zohoSalesOrderId: true },
        },
      },
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    // Check order status allows editing
    if (NON_EDITABLE_STATUSES.includes(item.order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot edit items in a delivered or cancelled order',
      });
    }

    // Build update object
    const updateData: {
      quantity?: number;
      pricePerCaseUsd?: number;
      totalUsd?: number;
      productName?: string;
      producer?: string;
      vintage?: string;
      notes?: string;
      lwin?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (quantity !== undefined) {
      updateData.quantity = quantity;
    }

    if (pricePerCaseUsd !== undefined) {
      updateData.pricePerCaseUsd = pricePerCaseUsd;
    }

    if (productName !== undefined) {
      updateData.productName = productName;
    }

    if (producer !== undefined) {
      updateData.producer = producer;
    }

    if (vintage !== undefined) {
      updateData.vintage = vintage;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (lwin !== undefined) {
      updateData.lwin = lwin;
    }

    // Calculate new total if quantity or price changed
    const newQuantity = quantity ?? item.quantity;
    const newPrice = pricePerCaseUsd ?? Number(item.pricePerCaseUsd);
    updateData.totalUsd = newQuantity * newPrice;

    // Update the item
    const [updatedItem] = await db
      .update(privateClientOrderItems)
      .set(updateData)
      .where(eq(privateClientOrderItems.id, itemId))
      .returning();

    // Recalculate order totals
    await recalculateOrderTotals(item.order.id);

    /*
      A line coded AFTER its sales order was raised: the Zoho item was created
      under the placeholder, so it is corrected there too. Only when the old
      code was a placeholder — re-coding a real LWIN is a change of wine, and
      renaming an item other orders may share is not this screen's call.
    */
    const salesOrderId = item.order.zohoSalesOrderId;
    const zohoRepair =
      lwin && item.lwin && !isUsableLwin18(item.lwin) && salesOrderId && salesOrderId !== CLAIM
        ? await repairZohoItemCode(
            salesOrderId,
            saleLwin18Of(item.lwin, item.caseConfig),
            saleLwin18Of(lwin, item.caseConfig),
          )
        : null;

    return { ...updatedItem, zohoRepair };
  });

export default adminUpdateItem;

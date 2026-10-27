import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import saleLwin18Of from '@/app/_privateClientOrders/utils/saleLwin18Of';
import announcePickList from '@/app/_wms/data/announcePickList';
import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsPickListItems,
  wmsPickLists,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { createPickListSchema } from '../schemas/pickListSchema';
import generatePickListNumber from '../utils/generatePickListNumber';
import resolvePickQuantities from '../utils/resolvePickQuantities';
import resolvePickStock from '../utils/resolvePickStock';

/**
 * Create a pick list from an order
 * Generates suggested pick locations based on available stock
 *
 * @example
 *   await trpcClient.wms.admin.picking.create.mutate({
 *     orderId: "uuid"
 *   });
 */
const adminCreatePickList = wmsOperatorProcedure
  .input(createPickListSchema)
  .mutation(async ({ input }) => {
    const { orderId } = input;

    const { pickList, pickListItems, pickListNumber } = await db.transaction(async (tx) => {
      // Get the order
      const [order] = await tx
        .select()
        .from(privateClientOrders)
        .where(eq(privateClientOrders.id, orderId))
        // A double tap waits here, then finds the first tap's pick list
        .for('update');

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Check if pick list already exists for this order
      const [existingPickList] = await tx
        .select()
        .from(wmsPickLists)
        .where(eq(wmsPickLists.orderId, orderId));

      if (existingPickList) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Pick list ${existingPickList.pickListNumber} already exists for this order`,
        });
      }

      // Get order items
      const orderItems = await tx
        .select()
        .from(privateClientOrderItems)
        .where(eq(privateClientOrderItems.orderId, orderId));

      if (orderItems.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Order has no items',
        });
      }

      // Generate pick list number
      const pickListNumber = await generatePickListNumber(tx);

      // Create pick list
      const [pickList] = await tx
        .insert(wmsPickLists)
        .values({
          pickListNumber,
          orderId,
          orderNumber: order.orderNumber,
          totalItems: orderItems.length,
          pickedItems: 0,
        })
        .returning();

      // Create pick list items with suggested locations
      const pickListItems = [];

      for (const item of orderItems) {
        // PCO line fields are `lwin`/`quantity` (not lwin18/quantityCases).
        // Pack-agnostic, in-stock-only match by LWIN7+vintage with a safe name
        // fallback — never pins an empty pack or a lookalike cuvée.
        const neededCases = item.quantity ?? 0;
        /*
          A cellar release names the parcel it must come from, because the wine
          belongs to the member who chose it. Every other order leaves this null
          and matches as before.
        */
        const suggestedStock = await resolvePickStock({
          sourceStockId: item.sourceStockId,
          lwin18: item.lwin,
          productName: item.productName,
          neededCases,
          db: tx,
        });

        /*
          The line's quantity is in the pack it is SOLD in. Two singles off a
          6-pack are caseConfig 1, quantity 2 — writing that as quantityCases 2
          sent the picker for two whole 6-packs. Measured in bottles, through the
          same helper release-to-pick and re-sync use, the case is cracked at the
          bay instead.
        */
        const quantities = resolvePickQuantities({
          quantity: neededCases,
          sku: item.lwin ? saleLwin18Of(item.lwin, item.caseConfig) : null,
          stockCaseConfig: suggestedStock?.caseConfig,
        });

        const [pickListItem] = await tx
          .insert(wmsPickListItems)
          .values({
            pickListId: pickList.id,
            lwin18: suggestedStock?.lwin18 ?? item.lwin ?? '',
            productName: item.productName,
            quantityCases: quantities.casesNeeded,
            quantityBottles: quantities.quantityBottles,
            suggestedLocationId: suggestedStock?.locationId ?? null,
            suggestedStockId: suggestedStock?.stockId ?? null,
            notes:
              suggestedStock?.matchedBy === 'pinned'
                ? `OWNER'S STOCK: pick this parcel only${
                    item.sourceLotNumber ? ` — lot ${item.sourceLotNumber}` : ''
                  }`
                : suggestedStock?.matchedBy === 'name'
                  ? 'VERIFY: matched by name (no LWIN match) — confirm the wine'
                  : null,
          })
          .returning();

        pickListItems.push(pickListItem);
      }

      return { pickList, pickListItems, pickListNumber };
    });

    // Tell #warehouse-activity a new list is out to the floor
    if (pickList) await announcePickList(pickList.id, 'released');

    return {
      success: true,
      pickList,
      items: pickListItems,
      message: `Pick list ${pickListNumber} created with ${pickListItems.length} items`,
    };
  });

export default adminCreatePickList;

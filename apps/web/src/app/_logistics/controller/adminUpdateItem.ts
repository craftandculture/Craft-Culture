import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import packFromLwin from '../utils/packFromLwin';
import recalcShipmentTotals from '../utils/recalcShipmentTotals';

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  productName: z.string().min(1).optional(),
  lwin: z.string().nullable().optional(),
  supplierSku: z.string().nullable().optional(),
  hsCode: z.string().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  producer: z.string().nullable().optional(),
  vintage: z.number().nullable().optional(),
  region: z.string().nullable().optional(),
  cases: z.number().int().min(1).optional(),
  bottlesPerCase: z.number().int().min(1).nullable().optional(),
  bottleSizeMl: z.number().int().min(1).nullable().optional(),
  productCostPerBottle: z.number().nullable().optional(),
  overrideOwnerId: z.string().uuid().nullable().optional(),
  overrideOwnerName: z.string().nullable().optional(),
});

/**
 * Update a shipment item's product identification fields
 *
 * Used by Head of Logistics to map LWIN codes and supplier SKUs
 * before goods arrive at warehouse.
 */
const adminUpdateItem = adminProcedure.input(updateItemSchema).mutation(async ({ input }) => {
  const { itemId, ...updateFields } = input;

  // Verify item exists
  const [existingItem] = await db
    .select()
    .from(logisticsShipmentItems)
    .where(eq(logisticsShipmentItems.id, itemId));

  if (!existingItem) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Shipment item not found',
    });
  }

  // Build update object — only include provided fields
  const updateData: Partial<typeof logisticsShipmentItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  const fieldMap = [
    'productName', 'lwin', 'supplierSku', 'hsCode', 'countryOfOrigin',
    'producer', 'vintage', 'region', 'bottlesPerCase', 'bottleSizeMl', 'cases', 'productCostPerBottle',
    'overrideOwnerId', 'overrideOwnerName',
  ] as const;

  for (const key of fieldMap) {
    if (updateFields[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateData as any)[key] = updateFields[key];
    }
  }

  // Normalize LWIN to the canonical dashed form (raw 18-digit supplier codes
  // like Cult Wines' would otherwise create duplicate stock lines)
  if (updateData.lwin != null) {
    updateData.lwin = normalizeLwin18(updateData.lwin);
  }

  /**
   * Latching a LWIN settles the pack, because the LWIN already states it.
   *
   * `1148811-0000-02-00750` is a two-bottle pack of 75cl. Reading that off by
   * eye and typing it back in was the manual pass over this shipment — 163
   * lines of transcribing a number the code already carried.
   *
   * The bottle count is held and the cases recomputed, not the other way
   * round: the supplier billed bottles, so bottles are the fact. Anything the
   * caller set explicitly wins, since a correction should not be undone by
   * the code it is correcting.
   */
  const derived =
    updateFields.lwin !== undefined ? packFromLwin(updateData.lwin) : null;

  if (derived) {
    if (updateFields.bottlesPerCase === undefined) {
      updateData.bottlesPerCase = derived.bottlesPerCase;
    }

    if (updateFields.bottleSizeMl === undefined) {
      updateData.bottleSizeMl = derived.bottleSizeMl;
    }

    const bottles = existingItem.totalBottles ?? 0;
    const pack = updateData.bottlesPerCase ?? derived.bottlesPerCase;

    if (bottles > 0 && pack > 0 && updateFields.cases === undefined) {
      // A pack that does not divide the billed bottles is a real finding —
      // either the LWIN is the wrong format or the invoice was misread — so
      // the cases round up and the bottles stay untouched for someone to see.
      updateData.cases = Math.max(1, Math.ceil(bottles / pack));
    }
  }

  // Recalculate totalBottles if cases or bottlesPerCase changed
  const newCases = updateFields.cases ?? existingItem.cases;
  const newBpc = updateFields.bottlesPerCase ?? existingItem.bottlesPerCase ?? 12;
  if (
    !derived &&
    (updateFields.cases !== undefined || updateFields.bottlesPerCase !== undefined)
  ) {
    updateData.totalBottles = newCases * newBpc;
  }

  // Update the item
  const [updatedItem] = await db
    .update(logisticsShipmentItems)
    .set(updateData)
    .where(eq(logisticsShipmentItems.id, itemId))
    .returning();

  // Recompute shipment totals from line items when cases/pack changed
  if (updateFields.cases !== undefined || updateFields.bottlesPerCase !== undefined) {
    await recalcShipmentTotals(existingItem.shipmentId);
  }

  return updatedItem;
});

export default adminUpdateItem;

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  lwin: z.string().nullable().optional(),
  supplierSku: z.string().nullable().optional(),
  hsCode: z.string().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  producer: z.string().nullable().optional(),
  vintage: z.number().nullable().optional(),
  region: z.string().nullable().optional(),
  bottlesPerCase: z.number().int().min(1).nullable().optional(),
  bottleSizeMl: z.number().int().min(1).nullable().optional(),
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

  // Build update object (only include fields that are provided)
  const updateData: Partial<typeof logisticsShipmentItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updateFields.lwin !== undefined) {
    updateData.lwin = updateFields.lwin;
  }
  if (updateFields.supplierSku !== undefined) {
    updateData.supplierSku = updateFields.supplierSku;
  }
  if (updateFields.hsCode !== undefined) {
    updateData.hsCode = updateFields.hsCode;
  }
  if (updateFields.countryOfOrigin !== undefined) {
    updateData.countryOfOrigin = updateFields.countryOfOrigin;
  }
  if (updateFields.producer !== undefined) {
    updateData.producer = updateFields.producer;
  }
  if (updateFields.vintage !== undefined) {
    updateData.vintage = updateFields.vintage;
  }
  if (updateFields.region !== undefined) {
    updateData.region = updateFields.region;
  }
  if (updateFields.bottlesPerCase !== undefined) {
    updateData.bottlesPerCase = updateFields.bottlesPerCase;
  }
  if (updateFields.bottleSizeMl !== undefined) {
    updateData.bottleSizeMl = updateFields.bottleSizeMl;
  }

  // Recalculate totalBottles if bottlesPerCase changed
  if (updateFields.bottlesPerCase !== undefined) {
    const bpc = updateFields.bottlesPerCase ?? existingItem.bottlesPerCase ?? 12;
    updateData.totalBottles = existingItem.cases * bpc;
  }

  // Update the item
  const [updatedItem] = await db
    .update(logisticsShipmentItems)
    .set(updateData)
    .where(eq(logisticsShipmentItems.id, itemId))
    .returning();

  return updatedItem;
});

export default adminUpdateItem;

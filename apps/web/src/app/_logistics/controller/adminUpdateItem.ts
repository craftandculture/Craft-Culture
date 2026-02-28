import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

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
  ] as const;

  for (const key of fieldMap) {
    if (updateFields[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateData as any)[key] = updateFields[key];
    }
  }

  // Recalculate totalBottles if cases or bottlesPerCase changed
  const newCases = updateFields.cases ?? existingItem.cases;
  const newBpc = updateFields.bottlesPerCase ?? existingItem.bottlesPerCase ?? 12;
  if (updateFields.cases !== undefined || updateFields.bottlesPerCase !== undefined) {
    updateData.totalBottles = newCases * newBpc;
  }

  // Update the item
  const [updatedItem] = await db
    .update(logisticsShipmentItems)
    .set(updateData)
    .where(eq(logisticsShipmentItems.id, itemId))
    .returning();

  // Update shipment totals if cases changed
  if (updateFields.cases !== undefined || updateFields.bottlesPerCase !== undefined) {
    const caseDiff = (updateFields.cases ?? existingItem.cases) - existingItem.cases;
    const newTotalBottles = newCases * newBpc;
    const oldTotalBottles = existingItem.totalBottles ?? existingItem.cases * (existingItem.bottlesPerCase ?? 12);
    const bottleDiff = newTotalBottles - oldTotalBottles;

    if (caseDiff !== 0 || bottleDiff !== 0) {
      await db
        .update(logisticsShipments)
        .set({
          totalCases: sql`COALESCE(${logisticsShipments.totalCases}, 0) + ${caseDiff}`,
          totalBottles: sql`COALESCE(${logisticsShipments.totalBottles}, 0) + ${bottleDiff}`,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipments.id, existingItem.shipmentId));
    }
  }

  return updatedItem;
});

export default adminUpdateItem;

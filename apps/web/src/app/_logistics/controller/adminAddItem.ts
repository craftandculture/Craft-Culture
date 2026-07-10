import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import addItemSchema from '../schemas/addItemSchema';
import recalcShipmentTotals from '../utils/recalcShipmentTotals';

/**
 * Add an item to a logistics shipment
 *
 * Creates a new shipment item and updates the shipment totals.
 */
const adminAddItem = adminProcedure.input(addItemSchema).mutation(async ({ input }) => {
  const {
    shipmentId,
    productId,
    productName,
    producer,
    vintage,
    region,
    countryOfOrigin,
    hsCode,
    cases,
    bottlesPerCase,
    bottleSizeMl,
    grossWeightKg,
    netWeightKg,
    declaredValueUsd,
    productCostPerBottle,
    targetSellingPrice,
    notes,
  } = input;

  // Verify shipment exists
  const shipment = await db.query.logisticsShipments.findFirst({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Shipment not found',
    });
  }

  // Calculate total bottles
  const totalBottles = cases * (bottlesPerCase ?? 12);

  // Create the item
  const items = await db
    .insert(logisticsShipmentItems)
    .values({
      shipmentId,
      productId,
      productName,
      producer,
      vintage,
      region,
      countryOfOrigin,
      hsCode,
      cases,
      bottlesPerCase: bottlesPerCase ?? 12,
      bottleSizeMl: bottleSizeMl ?? 750,
      totalBottles,
      grossWeightKg,
      netWeightKg,
      declaredValueUsd,
      productCostPerBottle,
      targetSellingPrice,
      notes,
    })
    .returning();

  const item = items[0];
  if (!item) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create item',
    });
  }

  // Recompute shipment totals from line items (drift-proof)
  await recalcShipmentTotals(shipmentId);

  return item;
});

export default adminAddItem;

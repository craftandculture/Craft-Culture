import { TRPCError } from '@trpc/server';
import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { autoPopulateImportPriceSchema } from '../schemas/pricingSchema';

/**
 * Auto-populate import price from the latest logistics shipment for a product
 *
 * Finds the most recent shipment item matching this LWIN18 via wmsStock.shipmentId,
 * and uses its landedCostPerBottle as the import price.
 *
 * @param lwin18 - The product LWIN18 identifier
 */
const adminAutoPopulateImportPrice = adminProcedure
  .input(autoPopulateImportPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18 } = input;

    // Find the latest shipment item for this LWIN18 via wmsStock → logisticsShipmentItems
    // Prefer landedCostPerBottle, fall back to productCostPerBottle
    const [shipmentItem] = await db
      .select({
        id: logisticsShipmentItems.id,
        landedCostPerBottle: logisticsShipmentItems.landedCostPerBottle,
        productCostPerBottle: logisticsShipmentItems.productCostPerBottle,
        productName: logisticsShipmentItems.productName,
        shipmentId: logisticsShipmentItems.shipmentId,
      })
      .from(wmsStock)
      .innerJoin(
        logisticsShipmentItems,
        sql`${logisticsShipmentItems.shipmentId} = ${wmsStock.shipmentId}
          AND ${logisticsShipmentItems.lwin} = ${wmsStock.lwin18}`,
      )
      .where(eq(wmsStock.lwin18, lwin18))
      .orderBy(desc(logisticsShipmentItems.createdAt))
      .limit(1);

    const costPerBottle =
      shipmentItem?.landedCostPerBottle ??
      shipmentItem?.productCostPerBottle ??
      null;

    if (!shipmentItem || costPerBottle === null) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          'No shipment found with cost data for this product. Set the price manually.',
      });
    }

    const [result] = await db
      .insert(wmsProductPricing)
      .values({
        lwin18,
        importPricePerBottle: costPerBottle,
        importPriceSource: 'shipment',
        shipmentItemId: shipmentItem.id,
        updatedBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: wmsProductPricing.lwin18,
        set: {
          importPricePerBottle: costPerBottle,
          importPriceSource: 'shipment' as const,
          shipmentItemId: shipmentItem.id,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      ...result,
      sourceProductName: shipmentItem.productName,
      costSource: shipmentItem.landedCostPerBottle
        ? 'landedCost'
        : 'productCost',
    };
  });

export default adminAutoPopulateImportPrice;

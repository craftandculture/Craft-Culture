import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  wmsStock,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { autoPopulateImportPriceSchema } from '../schemas/pricingSchema';
import writeProductPricing from '../utils/writeProductPricing';

/**
 * Auto-populate import price from the latest logistics shipment for a product
 *
 * Finds the most recent shipment item matching this LWIN18 via wmsStock.shipmentId,
 * and uses its landedCostPerBottle as the import price.
 *
 * @param lwin18 - The product LWIN18 identifier
 */
const adminAutoPopulateImportPrice = wmsOperatorProcedure
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
        and(
          eq(logisticsShipmentItems.shipmentId, wmsStock.shipmentId),
          eq(logisticsShipmentItems.lwin, wmsStock.lwin18),
        ),
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

    // Every pack of the wine, as every other pricing write does
    await writeProductPricing({
      lwin18,
      set: {
        importPricePerBottle: costPerBottle,
        importPriceSource: 'shipment',
        shipmentItemId: shipmentItem.id,
      },
      userId: ctx.user.id,
    });

    return {
      importPricePerBottle: costPerBottle,
      sourceProductName: shipmentItem.productName,
      costSource: shipmentItem.landedCostPerBottle
        ? 'landedCost'
        : 'productCost',
    };
  });

export default adminAutoPopulateImportPrice;

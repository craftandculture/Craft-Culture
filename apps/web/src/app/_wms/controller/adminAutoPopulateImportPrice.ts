import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
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

    await db.execute(sql`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, import_price_source, shipment_item_id, updated_by)
      VALUES (${lwin18}, ${costPerBottle}, ${'shipment'}, ${shipmentItem.id}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        import_price_per_bottle = ${costPerBottle},
        import_price_source = ${'shipment'},
        shipment_item_id = ${shipmentItem.id},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `);

    return {
      importPricePerBottle: costPerBottle,
      sourceProductName: shipmentItem.productName,
      costSource: shipmentItem.landedCostPerBottle
        ? 'landedCost'
        : 'productCost',
    };
  });

export default adminAutoPopulateImportPrice;

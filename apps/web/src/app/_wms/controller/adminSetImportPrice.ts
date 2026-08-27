import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setImportPriceSchema } from '../schemas/pricingSchema';

/**
 * Upsert import price for a product by LWIN18
 *
 * Uses raw postgres-js client to bypass Drizzle's RLS query builder.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param importPricePerBottle - Price per bottle in USD
 * @param source - Whether price was set manually or from a shipment
 * @param shipmentItemId - Optional reference to the source shipment item
 * @param notes - Optional notes about the price
 */
const adminSetImportPrice = wmsOperatorProcedure
  .input(setImportPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, importPricePerBottle, source, shipmentItemId, notes } =
      input;

    await client`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, import_price_source, shipment_item_id, notes, updated_by)
      VALUES (${lwin18}, ${importPricePerBottle}, ${source}, ${shipmentItemId ?? null}, ${notes ?? null}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        import_price_per_bottle = ${importPricePerBottle},
        import_price_source = ${source},
        shipment_item_id = ${shipmentItemId ?? null},
        notes = ${notes ?? null},
        -- A re-costed wine drops off the price lists until someone re-checks it.
        -- Otherwise it keeps selling at a price built on the OLD cost, which is
        -- exactly how a buy price ends up published and then quietly moved.
        pricing_released_at = CASE
          WHEN wms_product_pricing.import_price_per_bottle IS DISTINCT FROM ${importPricePerBottle}
          THEN NULL ELSE wms_product_pricing.pricing_released_at END,
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    return { lwin18, importPricePerBottle, source };
  });

export default adminSetImportPrice;

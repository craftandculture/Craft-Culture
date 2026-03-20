import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setImportPriceSchema } from '../schemas/pricingSchema';

/**
 * Upsert import price for a product by LWIN18
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param importPricePerBottle - Price per bottle in USD
 * @param source - Whether price was set manually or from a shipment
 * @param shipmentItemId - Optional reference to the source shipment item
 * @param notes - Optional notes about the price
 */
const adminSetImportPrice = adminProcedure
  .input(setImportPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, importPricePerBottle, source, shipmentItemId, notes } =
      input;

    await db.execute(sql`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, import_price_source, shipment_item_id, notes, updated_by)
      VALUES (${lwin18}, ${importPricePerBottle}, ${source}, ${shipmentItemId ?? null}, ${notes ?? null}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        import_price_per_bottle = ${importPricePerBottle},
        import_price_source = ${source},
        shipment_item_id = ${shipmentItemId ?? null},
        notes = ${notes ?? null},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `);

    return { lwin18, importPricePerBottle, source };
  });

export default adminSetImportPrice;

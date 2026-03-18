import db from '@/database/client';
import { wmsProductPricing } from '@/database/schema';
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

    const [result] = await db
      .insert(wmsProductPricing)
      .values({
        lwin18,
        importPricePerBottle,
        importPriceSource: source,
        shipmentItemId: shipmentItemId ?? null,
        notes: notes ?? null,
        updatedBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: wmsProductPricing.lwin18,
        set: {
          importPricePerBottle,
          importPriceSource: source,
          shipmentItemId: shipmentItemId ?? null,
          notes: notes ?? null,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  });

export default adminSetImportPrice;

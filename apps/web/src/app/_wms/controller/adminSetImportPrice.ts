import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsProductPricing } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setImportPriceSchema } from '../schemas/pricingSchema';
import lwinPakKey from '../utils/lwinPakKey';
import pakKeyOf from '../utils/pakKeyOf';
import writeProductPricing from '../utils/writeProductPricing';

/**
 * Set the import price for a product, on every pack of the wine
 *
 * This was the one pricing edit left writing to the exact LWIN18 only. A wine
 * held as a 2-pack and a 3-pack keeps one price row per pack; the import typed
 * on one landed there alone, the Pricing Manager showed MAX() across both, and
 * the price list — which prefers the line's own row — kept pricing from the
 * old figure. Cristal Rosé 2013 read $546.92 internally and $444.01 on the
 * price list for exactly this reason.
 *
 * A re-costed wine drops off the price lists until someone re-checks it, so the
 * release is cleared whenever any of the wine's rows held a different cost.
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

    const current = await db
      .select({ importPrice: wmsProductPricing.importPricePerBottle })
      .from(wmsProductPricing)
      .where(sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${pakKeyOf(lwin18)}`);

    const recosted = current.some(
      (row) => row.importPrice !== importPricePerBottle,
    );

    await writeProductPricing({
      lwin18,
      set: {
        importPricePerBottle,
        importPriceSource: source,
        shipmentItemId: shipmentItemId ?? null,
        notes: notes ?? null,
        ...(recosted ? { pricingReleasedAt: null } : {}),
      },
      userId: ctx.user.id,
    });

    return { lwin18, importPricePerBottle, source };
  });

export default adminSetImportPrice;

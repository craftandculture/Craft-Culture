import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setTransferPriceSchema } from '../schemas/pricingManagerSchema';

/**
 * Upsert a per-SKU FZ→mainland transfer fee ($/btl) by LWIN18.
 *
 * The transfer fee is one component of landed cost
 * (landed = import + logistics + transfer + override). A null value clears the
 * per-SKU fee so the row falls back to the $2.50 default applied in pricing.
 *
 * Uses the raw postgres-js client to match the other pricing upserts.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param transferPricePerBottle - Per-bottle transfer fee in USD, or null to clear
 */
const adminSetTransferPrice = wmsOperatorProcedure
  .input(setTransferPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, transferPricePerBottle } = input;

    await client`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, transfer_price_per_bottle, updated_by)
      VALUES (${lwin18}, 0, ${transferPricePerBottle}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        transfer_price_per_bottle = ${transferPricePerBottle},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    return { lwin18, transferPricePerBottle };
  });

export default adminSetTransferPrice;

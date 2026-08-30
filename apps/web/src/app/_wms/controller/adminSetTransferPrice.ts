import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setTransferPriceSchema } from '../schemas/pricingManagerSchema';
import writeProductPricing from '../utils/writeProductPricing';


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

    await writeProductPricing({ lwin18, set: { transferPricePerBottle }, userId: ctx.user.id });

    return { lwin18, transferPricePerBottle };
  });

export default adminSetTransferPrice;

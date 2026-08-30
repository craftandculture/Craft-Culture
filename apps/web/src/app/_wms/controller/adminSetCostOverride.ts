import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setCostOverrideSchema } from '../schemas/pricingManagerSchema';
import writeProductPricing from '../utils/writeProductPricing';


/**
 * Upsert a manual per-SKU landed-cost override by LWIN18.
 *
 * The override is added to import + logistics to give the landed cost
 * (landed = import + logistics + override) — used when a stored import price
 * is meaningless for an owner (e.g. Cru Wine) and the true cost must be set
 * per SKU. May be negative (to correct an overstated import) or null (clear).
 *
 * Uses the raw postgres-js client to match the other pricing upserts.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param costOverridePerBottle - Per-bottle override in USD, or null to clear
 */
const adminSetCostOverride = wmsOperatorProcedure
  .input(setCostOverrideSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, costOverridePerBottle } = input;

    await writeProductPricing({ lwin18, set: { costOverridePerBottle }, userId: ctx.user.id });

    return { lwin18, costOverridePerBottle };
  });

export default adminSetCostOverride;

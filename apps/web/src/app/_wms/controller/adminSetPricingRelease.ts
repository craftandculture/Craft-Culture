import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import writeProductPricing from '../utils/writeProductPricing';

/**
 * Release wines to the price lists, or pull them back off.
 *
 * Nothing reaches a customer-facing surface until this is set: stock used to be
 * listed the moment logistics booked it in, before freight was allocated or a
 * margin agreed, which published a price barely above the buy price and then
 * moved it once the real costs arrived.
 *
 * Releasing is deliberately an act, not a side effect of arriving.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.setRelease.mutate({
 *     lwin18s: ['1014525-2019-06-00750'], released: true,
 *   });
 */
const adminSetPricingRelease = wmsOperatorProcedure
  .input(
    z.object({
      lwin18s: z.array(z.string()).min(1).max(500),
      released: z.boolean(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { lwin18s, released } = input;

    /*
      Matched the way the price lists match.

      Both branches keyed on the exact LWIN18 while every read joins pricing
      pack-agnostically, so pulling a wine back off the list updated a row that
      did not exist — the 2-pack line's code against a price row created as a
      6-pack — and the badge stayed. Worse, it then reported success, because
      the count returned was how many wines were asked for rather than how many
      were changed.
    */
    const rowsChanged = (
      await Promise.all(
        lwin18s.map((lwin18) =>
          writeProductPricing({
            lwin18,
            set: {
              pricingReleasedAt: released ? new Date() : null,
              pricingReleasedBy: ctx.user.id,
            },
            userId: ctx.user.id,
          }),
        ),
      )
    ).reduce((sum, n) => sum + n, 0);

    return { released, count: lwin18s.length, touched: rowsChanged };
  });

export default adminSetPricingRelease;

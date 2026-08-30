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
 * The flag lives on the pricing row, which is keyed on the wine — so releasing
 * a wine releases every owner's holding of it. That is wrong, and a per-owner
 * version of this was built and reverted: it depended on a table the deploy
 * never created, and the failure took the whole in-transit list down rather
 * than one wine off it. It is worth redoing with the migration confirmed first.
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
      /** Accepted but unused until per-owner release lands again */
      ownerId: z.string().uuid().optional(),
      released: z.boolean(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { lwin18s, released } = input;

    const touched = (
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

    return { released, count: lwin18s.length, touched };
  });

export default adminSetPricingRelease;

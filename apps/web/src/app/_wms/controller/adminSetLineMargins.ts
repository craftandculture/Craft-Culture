import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import writeProductPricing from '../utils/writeProductPricing';

/**
 * Set the margin on one wine or on many at once.
 *
 * Stores a MARGIN rather than a price, so the figure keeps working when the
 * cost moves — a bulk-applied price silently goes stale the moment freight is
 * allocated, which is how wine ends up selling on last month's cost.
 *
 * Passing null for a book clears that override, handing the wine back to the
 * tiers. One line and a whole shipment go through the same path: apply a flat
 * percentage across the lines on screen, then override the few that need it.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.setLineMargins.mutate({
 *     lwin18s: ['1014525-2019-06-00750'], b2bMarginPct: 20, pcMarginPct: 30,
 *   });
 */
const adminSetLineMargins = wmsOperatorProcedure
  .input(
    z.object({
      lwin18s: z.array(z.string()).min(1).max(500),
      /** Null clears the override for that book. */
      b2bMarginPct: z.number().min(0).lt(100).nullable().optional(),
      pcMarginPct: z.number().min(0).lt(100).nullable().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { lwin18s, b2bMarginPct, pcMarginPct } = input;

    if (b2bMarginPct === undefined && pcMarginPct === undefined) {
      return { updated: 0 };
    }

    /*
      Applied to the rows the price screens read.

      This keyed on the exact LWIN18, while every read joins pricing
      pack-agnostically — so a margin set from a 2-pack line landed on a new
      row while the 6-pack row the screen was reading kept the old figure.
    */
    await Promise.all(
      lwin18s.map((lwin18) =>
        writeProductPricing({
          lwin18,
          set: {
            ...(b2bMarginPct !== undefined ? { b2bMarginPct: b2bMarginPct ?? null } : {}),
            ...(pcMarginPct !== undefined ? { pcMarginPct: pcMarginPct ?? null } : {}),
          },
          userId: ctx.user.id,
        }),
      ),
    );

    return { updated: lwin18s.length, b2bMarginPct, pcMarginPct };
  });

export default adminSetLineMargins;

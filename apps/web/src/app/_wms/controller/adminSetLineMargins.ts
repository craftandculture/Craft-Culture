import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsProductPricing } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

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

    // A wine priced for the first time may have no pricing row yet; the insert
    // creates it so the margin is recorded rather than quietly dropped.
    await db
      .insert(wmsProductPricing)
      .values(
        lwin18s.map((lwin18) => ({
          lwin18,
          importPricePerBottle: 0,
          b2bMarginPct: b2bMarginPct ?? null,
          pcMarginPct: pcMarginPct ?? null,
          updatedBy: ctx.user.id,
        })),
      )
      .onConflictDoUpdate({
        target: wmsProductPricing.lwin18,
        set: {
          ...(b2bMarginPct !== undefined
            ? { b2bMarginPct: b2bMarginPct }
            : {}),
          ...(pcMarginPct !== undefined ? { pcMarginPct: pcMarginPct } : {}),
          updatedBy: ctx.user.id,
          updatedAt: sql`NOW()`,
        },
      });

    return { updated: lwin18s.length, b2bMarginPct, pcMarginPct };
  });

export default adminSetLineMargins;

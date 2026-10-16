import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineKey from '../utils/wineKey';
import wineLandedReady from '../utils/wineLandedReady';

/**
 * Set what a wine cost one owner, by hand
 *
 * For the wines the Pricing Manager cannot answer for. One wine held by two
 * owners has one price there and two real costs — Montille Bourgogne Blanc and
 * Dancer Hautes-Cotes Blanc are both Crurated's and Ihab's — and paying both
 * from one figure overpays one of them out of the other's margin.
 *
 * Written as `by-hand`, which outranks the Pricing Manager from then on:
 * somebody has looked at this wine and this owner, and that beats a shared
 * figure inferred for neither. Clearing it hands the wine back to the Pricing
 * Manager.
 *
 * @param ownerId - Whose cost
 * @param lwin18 - The wine; keyed pack-agnostically, as everywhere here
 * @param landedPerBottle - What it cost them, or null to stop saying
 * @returns The wine and what is now recorded against it
 */
const adminSetWineLanded = adminProcedure
  .input(
    z.object({
      ownerId: z.string().uuid(),
      lwin18: z.string().min(1).max(50),
      productName: z.string().max(300).optional(),
      landedPerBottle: z.number().positive().max(1_000_000).nullable(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await wineLandedReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Per-owner landed costs are not available yet — the ' +
          'cons_wine_landed migration has not run on this database.',
      });
    }

    const key = wineKey(input.lwin18);

    if (input.landedPerBottle === null) {
      await client`
        DELETE FROM cons_wine_landed
        WHERE owner_id = ${input.ownerId} AND wine_key = ${key}
      `;

      return { wineKey: key, landedPerBottle: null };
    }

    await client`
      INSERT INTO cons_wine_landed (
        owner_id, wine_key, lwin18, product_name, landed_per_bottle,
        source, set_by
      )
      VALUES (
        ${input.ownerId}, ${key}, ${input.lwin18},
        ${input.productName ?? null}, ${input.landedPerBottle},
        'by-hand', ${ctx.user.id}
      )
      ON CONFLICT (owner_id, wine_key) DO UPDATE SET
        landed_per_bottle = EXCLUDED.landed_per_bottle,
        lwin18 = EXCLUDED.lwin18,
        product_name = COALESCE(
          EXCLUDED.product_name, cons_wine_landed.product_name
        ),
        source = 'by-hand',
        set_by = EXCLUDED.set_by,
        updated_at = NOW()
    `;

    return { wineKey: key, landedPerBottle: input.landedPerBottle };
  });

export default adminSetWineLanded;

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineOwnersReady from '../utils/wineOwnersReady';

/**
 * Say whose a wine is at an outlet, once, by hand
 *
 * The last word on ownership, because for some invoices it is the only word
 * available. A CONSIGNMENT_MIX invoice names its owners in header rows and
 * Zoho returns none of them — 292 rows read at City Drinks, 0 headers — so
 * seventeen lines of INV-000236 arrive anonymous however carefully the
 * document was written.
 *
 * Kept per wine rather than per line, because a wine's owner does not change
 * between invoices, and per outlet because the same wine can be placed with
 * two distributors on different terms.
 *
 * Takes effect on the next read of the invoices, where it outranks the
 * document's tag: a person correcting an attribution is more current than the
 * subject line that got it wrong.
 *
 * @param outletId - The distributor
 * @param lwin18 - The wine
 * @param ownerId - Whose it is, or null to stop saying
 * @returns What was set
 */
const adminSetWineOwner = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      lwin18: z.string().min(1).max(50),
      ownerId: z.string().uuid().nullable(),
      productName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await wineOwnersReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Per-wine owners are not available yet — the cons_wine_owners ' +
          'migration has not run on this database.',
      });
    }

    if (input.ownerId === null) {
      await client`
        DELETE FROM cons_wine_owners
        WHERE outlet_id = ${input.outletId} AND lwin18 = ${input.lwin18}
      `;

      return { lwin18: input.lwin18, ownerId: null };
    }

    await client`
      INSERT INTO cons_wine_owners (
        outlet_id, lwin18, owner_id, product_name, set_by
      )
      VALUES (
        ${input.outletId}, ${input.lwin18}, ${input.ownerId},
        ${input.productName ?? null}, ${ctx.user.id}
      )
      ON CONFLICT (outlet_id, lwin18) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        product_name = EXCLUDED.product_name,
        set_by = EXCLUDED.set_by,
        updated_at = NOW()
    `;

    return { lwin18: input.lwin18, ownerId: input.ownerId };
  });

export default adminSetWineOwner;

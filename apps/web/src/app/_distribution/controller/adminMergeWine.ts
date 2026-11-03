import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { packAgnostic } from '../utils/codeBridge';
import tableReady from '../utils/tableReady';
import wineKey from '../utils/wineKey';

/**
 * Fold one code into another wine at an outlet
 *
 * Moves the code's invoice lines and sales onto the kept wine, repoints any
 * code link that named it, and records the merge so the next Zoho sync and
 * sales import fold it in too — otherwise the sync would rebuild the old line
 * the next morning.
 *
 * @param outletId - The outlet
 * @param fromCode - The code to fold away, as held on the line
 * @param toLwin18 - The wine it is
 * @returns How many lines moved
 */
const adminMergeWine = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      fromCode: z.string().min(1).max(200),
      toLwin18: z.string().min(1).max(60),
      toName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_wine_aliases'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Merging is not available until the latest migration has run.',
      });
    }

    const fromKey = wineKey(input.fromCode);

    if (fromKey === wineKey(input.toLwin18)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That is already the same wine.',
      });
    }

    const keyOfLine = packAgnostic(
      () =>
        client`UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g'))`,
    );

    /*
      The merge is recorded first: if a later step fails, running it again
      finishes the job, and the next sync applies it regardless.
    */
    await client`
      INSERT INTO cons_wine_aliases (outlet_id, from_key, from_code, to_lwin18, to_name, set_by)
      VALUES (${input.outletId}, ${fromKey}, ${input.fromCode}, ${input.toLwin18},
              ${input.toName ?? null}, ${ctx.user.id})
      ON CONFLICT (outlet_id, from_key) DO UPDATE SET
        to_lwin18 = EXCLUDED.to_lwin18,
        to_name = EXCLUDED.to_name,
        set_by = EXCLUDED.set_by
    `;

    const lines = await client`
      UPDATE cons_movements m
      SET lwin18 = ${input.toLwin18},
          product_name = COALESCE(${input.toName ?? null}, m.product_name),
          updated_at = NOW()
      FROM cons_arrangements a
      WHERE a.id = m.arrangement_id
        AND a.outlet_id = ${input.outletId}
        AND ${keyOfLine} = ${fromKey}
    `;

    await client`
      UPDATE cons_code_links
      SET lwin18 = ${input.toLwin18}, updated_at = NOW()
      WHERE outlet_id = ${input.outletId}
        AND ${packAgnostic(
          () => client`UPPER(REGEXP_REPLACE(lwin18, '[^A-Za-z0-9]', '', 'g'))`,
        )} = ${fromKey}
    `;

    return { moved: lines.count, fromCode: input.fromCode, toLwin18: input.toLwin18 };
  });

export default adminMergeWine;

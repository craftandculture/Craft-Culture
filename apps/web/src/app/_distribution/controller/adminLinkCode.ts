import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { confirmedLinksReady } from '../utils/codeBridge';

/**
 * Tie one of the distributor's codes to one of our wines
 *
 * Confirmed by a person, because names cannot decide it and a wrong link
 * settles money against the wrong bottle. Recorded with both names as they
 * stood, so a link that later looks wrong can be recognised as wrong rather
 * than merely doubted.
 *
 * @param outletId - The distributor
 * @param outletCode - Their code
 * @param lwin18 - Our wine
 * @returns The link, or the removal
 */
const adminLinkCode = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      outletCode: z.string().min(1).max(120),
      lwin18: z.string().min(1).max(50).nullable(),
      outletProductName: z.string().max(300).optional(),
      ourProductName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    /*
      Schema is applied after the build and can quietly not run, so say which
      step is missing rather than surfacing a relation-does-not-exist error to
      someone halfway through mapping a hundred wines.
    */
    if (!(await confirmedLinksReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Code links are not available yet — the cons_code_links migration ' +
          'has not run on this database.',
      });
    }

    if (input.lwin18 === null) {
      await client`
        DELETE FROM cons_code_links
        WHERE outlet_id = ${input.outletId}
          AND outlet_code = ${input.outletCode}
      `;

      return { linked: false, outletCode: input.outletCode };
    }

    await client`
      INSERT INTO cons_code_links (
        outlet_id, outlet_code, lwin18, outlet_product_name,
        our_product_name, source, confirmed_by
      )
      VALUES (
        ${input.outletId}, ${input.outletCode}, ${input.lwin18},
        ${input.outletProductName ?? null}, ${input.ourProductName ?? null},
        'confirmed', ${ctx.user.id}
      )
      ON CONFLICT (outlet_id, outlet_code) DO UPDATE SET
        lwin18 = EXCLUDED.lwin18,
        outlet_product_name = EXCLUDED.outlet_product_name,
        our_product_name = EXCLUDED.our_product_name,
        confirmed_by = EXCLUDED.confirmed_by,
        updated_at = NOW()
    `;

    return { linked: true, outletCode: input.outletCode, lwin18: input.lwin18 };
  });

export default adminLinkCode;

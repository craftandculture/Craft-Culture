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
 * @param lwin18 - Our wine, or null to remove the link
 * @param notOurs - Record the line as their own stock instead
 * @returns The link, or the removal
 */
const adminLinkCode = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      outletCode: z.string().min(1).max(120),
      /** Several at once, for clearing a list of lines that are all theirs */
      alsoCodes: z.array(z.string().min(1).max(120)).max(200).optional(),
      lwin18: z.string().min(1).max(50).nullable(),
      /** Their own stock, wearing a Consigned flag — settled, not matched */
      notOurs: z.boolean().optional(),
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

    /*
      A line that is theirs is answered, not unanswered.

      City Drinks flag stock as consigned that they bought outright — Tignanello
      2022 sits on an invoice they paid — and until this there was no way to say
      so. Left alone such a line returns every time the page loads, which is how
      a list of four real questions hides inside a list of forty.

      It is recorded as a link to a code no wine carries. The bridge then
      resolves the line to something that matches nothing of ours, which is
      exactly what is true of it: counted nowhere, and never asked about again.
    */
    if (input.notOurs) {
      const codes = [input.outletCode, ...(input.alsoCodes ?? [])];

      for (const code of codes) {
        await client`
          INSERT INTO cons_code_links (
            outlet_id, outlet_code, lwin18, outlet_product_name,
            our_product_name, source, confirmed_by
          )
          VALUES (
            ${input.outletId}, ${code}, 'NOT-OURS',
            NULL, NULL, 'not-ours', ${ctx.user.id}
          )
          ON CONFLICT (outlet_id, outlet_code) DO UPDATE SET
            lwin18 = 'NOT-OURS',
            our_product_name = NULL,
            source = 'not-ours',
            confirmed_by = EXCLUDED.confirmed_by,
            updated_at = NOW()
        `;
      }

      return { linked: false, outletCode: `${codes.length} lines` };
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

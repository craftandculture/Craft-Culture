import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import tableReady from '../utils/tableReady';

/**
 * Share one outright invoice line between owners, bottles each
 *
 * For a line two owners' wine went out on under one pick (INV-411: 12 Montille,
 * 6 Crurated and 6 Ihab, all picked from Crurated's lot). Each owner is then
 * paid for their bottles at their own cost. Saving replaces the line's split;
 * an empty list takes it off, and bottles not covered go the usual way.
 *
 * @param invoiceLineId - The Zoho invoice line
 * @param parts - Each owner and their bottles
 * @returns How many parts were saved
 */
const adminSplitOutrightLine = adminProcedure
  .input(
    z.object({
      invoiceLineId: z.string().uuid(),
      parts: z
        .array(
          z.object({
            ownerPartnerId: z.string().uuid(),
            bottles: z.number().positive(),
          }),
        )
        .max(10),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_outright_splits'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Lines cannot be split on this database yet.',
      });
    }

    const owners = new Set(input.parts.map((part) => part.ownerPartnerId));

    if (owners.size !== input.parts.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name each owner once.' });
    }

    await client.begin(async (tx) => {
      await tx`DELETE FROM cons_outright_splits WHERE invoice_line_id = ${input.invoiceLineId}`;

      for (const part of input.parts) {
        await tx`
          INSERT INTO cons_outright_splits (invoice_line_id, owner_partner_id, bottles, set_by)
          VALUES (${input.invoiceLineId}, ${part.ownerPartnerId}, ${part.bottles}, ${ctx.user.id})
        `;
      }
    });

    return { saved: input.parts.length };
  });

export default adminSplitOutrightLine;

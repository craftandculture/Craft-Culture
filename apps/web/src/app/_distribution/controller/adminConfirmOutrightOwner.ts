import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import tableReady from '../utils/tableReady';

/**
 * Say whose wine an outright invoice line was
 *
 * For a wine two or more partners hold (Gravida: Crurated and Michael; Heitz
 * Corton-Charlemagne 2019: Crurated and Alain), or a line with no pick on
 * record. The answer is kept against the invoice line, so it holds whenever
 * the month is read again.
 *
 * @param invoiceLineId - The Zoho invoice line
 * @param ownerPartnerId - The partner whose wine it was
 * @returns Confirmation
 */
const adminConfirmOutrightOwner = adminProcedure
  .input(
    z.object({
      invoiceLineId: z.string().uuid(),
      ownerPartnerId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_outright_owners'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Outright owners cannot be confirmed on this database yet.',
      });
    }

    await client`
      INSERT INTO cons_outright_owners (invoice_line_id, owner_partner_id, set_by, set_at)
      VALUES (${input.invoiceLineId}, ${input.ownerPartnerId}, ${ctx.user.id}, now())
      ON CONFLICT (invoice_line_id) DO UPDATE SET
        owner_partner_id = EXCLUDED.owner_partner_id,
        set_by = EXCLUDED.set_by,
        set_at = now()
    `;

    return { confirmed: true };
  });

export default adminConfirmOutrightOwner;

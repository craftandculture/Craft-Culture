import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import wineOwnersReady from '../utils/wineOwnersReady';

/**
 * Give every wine on one invoice the same owner
 *
 * The per-wine setting is the right unit to store and the wrong unit to type.
 * INV-000236 carries seventeen lines, thirteen of them Craft & Culture's, and
 * saying so one dropdown at a time is how a correct answer goes unrecorded.
 *
 * So the invoice is the unit of work: set its owner, then fix the handful that
 * differ. On a MIX invoice that is four actions instead of seventeen, and the
 * four are the interesting ones.
 *
 * Existing settings are overwritten, because this is a person saying it again
 * and more recently. Wines on the invoice that carry no LWIN are skipped and
 * counted, since there is nothing to key them on.
 *
 * @param outletId - The distributor
 * @param docRef - The invoice number as the movement rows carry it
 * @param ownerId - Whose the wines on it are
 * @returns How many wines were set, and how many could not be
 */
const adminSetInvoiceOwner = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      docRef: z.string().min(1).max(120),
      ownerId: z.string().uuid(),
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

    const wines = await client<{ lwin18: string; productName: string }[]>`
      SELECT DISTINCT ON (m.lwin18) m.lwin18, m.product_name AS "productName"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'out'
        AND m.lwin18 IS NOT NULL
        AND UPPER(m.doc_ref) = UPPER(${input.docRef})
    `;

    if (wines.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No consigned lines at this outlet carry ${input.docRef}. Read the invoices first, or check the number.`,
      });
    }

    const rows = wines.map((wine) => ({
      outlet_id: input.outletId,
      lwin18: wine.lwin18,
      owner_id: input.ownerId,
      product_name: wine.productName,
      set_by: ctx.user.id,
    }));

    await client`
      INSERT INTO cons_wine_owners ${client(rows)}
      ON CONFLICT (outlet_id, lwin18) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        product_name = EXCLUDED.product_name,
        set_by = EXCLUDED.set_by,
        updated_at = NOW()
    `;

    return { docRef: input.docRef, wines: rows.length };
  });

export default adminSetInvoiceOwner;

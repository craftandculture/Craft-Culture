import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { INVOICE_TYPES } from '../utils/classifyInvoice';
import tableReady from '../utils/tableReady';

/**
 * Say what kind of invoice this was, overriding what the document implies
 *
 * Takes effect on the lines already in the ledger at once, so the month can
 * be re-matched without waiting for the next Zoho sync — and is kept, so the
 * next sync honours it. Clearing it hands the decision back to the document.
 *
 * Moving an invoice to or from outright changes whose stock its lines are
 * (City Drinks' own, or the partner's), and that only the sync can redo — so
 * the answer says when one is needed.
 *
 * @param outletId - The outlet
 * @param docRef - The invoice, e.g. INV-000197
 * @param invoiceType - The type, or null to let the document decide
 * @param ownerId - Whose stock the invoice was, where the document does not
 *   say (Cru's prepaid January invoices); null clears it
 * @returns The type now in force, and whether a sync is needed
 */
const adminSetInvoiceType = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      docRef: z.string().min(1).max(40),
      invoiceType: z.enum(INVOICE_TYPES).nullable(),
      ownerId: z.string().uuid().nullish(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('cons_invoice_types'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Invoice types are not on this database yet — their migration has not run.',
      });
    }

    const [before] = await client<{ invoiceType: string | null }[]>`
      SELECT MIN(m.invoice_type) AS "invoiceType"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'out' AND m.doc_ref = ${input.docRef}
    `;

    if (input.invoiceType === null) {
      await client`
        DELETE FROM cons_invoice_types
        WHERE outlet_id = ${input.outletId} AND doc_ref = ${input.docRef}
      `;

      return { docRef: input.docRef, invoiceType: null, needsSync: true };
    }

    await client`
      INSERT INTO cons_invoice_types (outlet_id, doc_ref, invoice_type, owner_id, set_by)
      VALUES (${input.outletId}, ${input.docRef}, ${input.invoiceType},
              ${input.ownerId ?? null}, ${ctx.user.id})
      ON CONFLICT (outlet_id, doc_ref) DO UPDATE SET
        invoice_type = EXCLUDED.invoice_type,
        ${input.ownerId !== undefined ? client`owner_id = EXCLUDED.owner_id,` : client``}
        set_by = EXCLUDED.set_by,
        updated_at = NOW()
    `;

    await client`
      UPDATE cons_movements m
      SET invoice_type = ${input.invoiceType}, updated_at = NOW()
      FROM cons_arrangements a
      WHERE a.id = m.arrangement_id
        AND a.outlet_id = ${input.outletId}
        AND m.kind = 'out' AND m.doc_ref = ${input.docRef}
    `;

    const crossesOwnStock =
      (before?.invoiceType === 'outright') !== (input.invoiceType === 'outright') ||
      input.ownerId !== undefined;

    return {
      docRef: input.docRef,
      invoiceType: input.invoiceType,
      needsSync: crossesOwnStock || input.invoiceType === 'pco',
    };
  });

export default adminSetInvoiceType;

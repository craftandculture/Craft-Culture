import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import tableReady from '../utils/tableReady';

/**
 * Every invoice to the outlet in the ledger, with its type
 *
 * The type decides whether a bottle sold against the invoice is billed and
 * paid, so it is shown on every invoice and can be corrected where the
 * document got it wrong.
 *
 * @param outletId - The outlet
 * @returns Invoices, newest first, with type, owners, lines and bottles
 */
const adminGetInvoices = adminProcedure
  .input(z.object({ outletId: z.string().uuid() }))
  .query(async ({ input }) => {
    if (!(await tableReady('cons_invoice_types'))) return { invoices: [] };

    const invoices = await client<
      {
        docRef: string;
        docDate: string | null;
        invoiceType: string | null;
        setByHand: boolean;
        owners: string[];
        lines: number;
        bottles: number;
      }[]
    >`
      SELECT m.doc_ref AS "docRef", MIN(m.doc_date)::text AS "docDate",
             MIN(m.invoice_type) AS "invoiceType",
             BOOL_OR(t.id IS NOT NULL) AS "setByHand",
             ARRAY_AGG(DISTINCT ow.name ORDER BY ow.name) AS owners,
             COUNT(*)::int AS lines,
             SUM(m.bottles)::float8 AS bottles
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      JOIN cons_owners ow ON ow.id = a.owner_id
      LEFT JOIN cons_invoice_types t
        ON t.outlet_id = a.outlet_id AND t.doc_ref = m.doc_ref
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'out' AND m.doc_ref IS NOT NULL
      GROUP BY m.doc_ref
      ORDER BY MIN(m.doc_date) DESC NULLS LAST, m.doc_ref DESC
    `;

    return { invoices };
  });

export default adminGetInvoices;

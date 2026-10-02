import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceVersions, exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Cancel an issued export invoice
 *
 * Issued documents are not deleted: the EXP number has been used, and a gap in
 * the sequence is what a customs officer asks about. Cancelling keeps the
 * record and its number, frees its Zoho invoices for a new export invoice, and
 * logs who cancelled it and why.
 */
const adminCancelIssued = adminProcedure
  .input(z.object({ id: z.string().uuid(), reason: z.string().min(3).max(500) }))
  .mutation(async ({ input, ctx }) => {
    const [row] = await db.select().from(exportInvoices).where(eq(exportInvoices.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Export invoice not found.' });
    if (row.status !== 'issued') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only an issued export invoice can be cancelled; discard a draft instead.' });
    }

    const version = row.version + 1;
    await db.transaction(async (tx) => {
      await tx
        .update(exportInvoices)
        .set({ status: 'cancelled', version, updatedAt: new Date() })
        .where(eq(exportInvoices.id, row.id));
      await tx.insert(exportInvoiceVersions).values({
        exportInvoiceId: row.id,
        version,
        document: row.document,
        ops: [],
        request: input.reason,
        changeSummary: `Cancelled ${row.number ?? ''}`.trim(),
        createdBy: ctx.user.id,
      });
    });
    return { ok: true };
  });

export default adminCancelIssued;

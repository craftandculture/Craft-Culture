import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceVersions, exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Reopen an issued export invoice to revise it
 *
 * The document goes back to draft but keeps its EXP number, so a correction
 * customs ask for after release is a new version of the same document rather
 * than a new number. Re-issuing saves a new PDF; every earlier PDF stays in
 * the history.
 */
const adminReopen = adminProcedure
  .input(z.object({ id: z.string().uuid(), reason: z.string().min(3).max(500) }))
  .mutation(async ({ input, ctx }) => {
    const [row] = await db.select().from(exportInvoices).where(eq(exportInvoices.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Export invoice not found.' });
    if (row.status !== 'issued') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only an issued export invoice can be reopened.' });
    }

    const version = row.version + 1;
    await db.transaction(async (tx) => {
      await tx
        .update(exportInvoices)
        .set({ status: 'draft', version, updatedAt: new Date() })
        .where(eq(exportInvoices.id, row.id));
      await tx.insert(exportInvoiceVersions).values({
        exportInvoiceId: row.id,
        version,
        document: row.document,
        ops: [],
        request: input.reason,
        changeSummary: `Reopened ${row.number ?? ''} to revise`.trim(),
        createdBy: ctx.user.id,
      });
    });
    return { ok: true };
  });

export default adminReopen;

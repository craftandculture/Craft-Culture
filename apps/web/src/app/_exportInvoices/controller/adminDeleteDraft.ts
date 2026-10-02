import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/** Discard a draft; issued export invoices are kept for good */
const adminDeleteDraft = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const deleted = await db
      .delete(exportInvoices)
      .where(and(eq(exportInvoices.id, input.id), eq(exportInvoices.status, 'draft')))
      .returning({ id: exportInvoices.id });
    if (deleted.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a draft can be discarded.' });
    }
    return { ok: true };
  });

export default adminDeleteDraft;

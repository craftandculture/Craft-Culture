import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/** Delete a draft that was never issued; anything with an EXP number is kept */
const adminDeleteDraft = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const deleted = await db
      .delete(exportInvoices)
      .where(and(eq(exportInvoices.id, input.id), eq(exportInvoices.status, 'draft'), isNull(exportInvoices.number)))
      .returning({ id: exportInvoices.id });
    if (deleted.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only an unnumbered draft can be deleted. A document being revised keeps its number; cancel it instead.' });
    }
    return { ok: true };
  });

export default adminDeleteDraft;

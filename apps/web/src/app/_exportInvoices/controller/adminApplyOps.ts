import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceVersions, exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import loadExportInvoice from '../data/loadExportInvoice';
import { exportOpSchema } from '../schemas/exportOpSchema';
import applyExportOps from '../utils/applyExportOps';

/**
 * Apply edits to a draft export invoice and save a new version
 *
 * Direct edits and accepted change requests both arrive here, so every change
 * is versioned with who made it, the ops, and the words that asked for it.
 * `expectedVersion` stops two people overwriting each other's edits.
 */
const adminApplyOps = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      expectedVersion: z.number().int(),
      ops: z.array(exportOpSchema).min(1),
      request: z.string().max(2000).optional(),
      changeSummary: z.string().max(2000).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { row, document } = await loadExportInvoice(input.id);
    if (row.status !== 'draft') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'An issued export invoice cannot be edited.' });
    }
    if (row.version !== input.expectedVersion) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Someone else changed this document. Reload to see their changes, then try again.',
      });
    }

    let next;
    try {
      next = applyExportOps(document, input.ops);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'That change could not be applied.',
      });
    }

    const version = row.version + 1;
    await db.transaction(async (tx) => {
      await tx
        .update(exportInvoices)
        .set({ document: next, version, updatedAt: new Date() })
        .where(eq(exportInvoices.id, row.id));
      await tx.insert(exportInvoiceVersions).values({
        exportInvoiceId: row.id,
        version,
        document: next,
        ops: input.ops,
        request: input.request ?? null,
        changeSummary: input.changeSummary ?? null,
        createdBy: ctx.user.id,
      });
    });

    return { version };
  });

export default adminApplyOps;

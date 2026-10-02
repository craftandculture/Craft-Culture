import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceSources, exportInvoiceVersions, exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import logger from '@/utils/logger';

import buildExportDraft from '../data/buildExportDraft';

/**
 * Build a draft export invoice from chosen Zoho invoices
 *
 * The draft is saved as version 1 with a snapshot of each invoice, so a later
 * reissue in Zoho is noticed. Standing rules are replayed in the build and
 * reported, so the operator can see which ones applied.
 */
const adminCreateDraft = adminProcedure
  .input(
    z.object({
      zohoCustomerId: z.string(),
      consigneeName: z.string(),
      zohoInvoiceIds: z.array(z.string()).min(1),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Zoho is not configured on this environment.' });
    }

    let built;
    try {
      built = await buildExportDraft(input);
    } catch (error) {
      logger.error('Export draft build failed', { error, input });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Could not build the draft. ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(exportInvoices)
        .values({
          zohoCustomerId: input.zohoCustomerId,
          consigneeName: built.document.header.consignee.name || input.consigneeName,
          document: built.document,
          createdBy: ctx.user.id,
        })
        .returning({ id: exportInvoices.id });
      if (!row) throw new Error('insert failed');

      await tx.insert(exportInvoiceVersions).values({
        exportInvoiceId: row.id,
        version: 1,
        document: built.document,
        ops: [],
        changeSummary: `Built from ${built.invoices.map((i) => i.invoiceNumber).join(', ')}`,
        createdBy: ctx.user.id,
      });
      await tx.insert(exportInvoiceSources).values(
        built.invoices.map((i) => ({
          exportInvoiceId: row.id,
          zohoInvoiceId: i.zohoInvoiceId,
          invoiceNumber: i.invoiceNumber,
          snapshotTotal: i.totalUsd,
        })),
      );
      return row.id;
    });

    return { id, ruleResults: built.ruleResults };
  });

export default adminCreateDraft;

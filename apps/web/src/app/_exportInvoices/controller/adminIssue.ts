import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceVersions, exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import findStaleSources from '../data/findStaleSources';
import loadExportInvoice from '../data/loadExportInvoice';
import generateExportInvoiceNumber from '../utils/generateExportInvoiceNumber';
import renderExportInvoicePDF from '../utils/renderExportInvoicePDF';
import validateExportDocument from '../utils/validateExportDocument';

/**
 * Issue an export invoice: number it, render the PDF, freeze it
 *
 * Refused while any check is an error, and the warnings must have been seen —
 * the caller passes the codes it showed, so a warning that appeared since
 * (an invoice reissued a minute ago) stops the issue rather than slipping by.
 */
const adminIssue = adminProcedure
  .input(z.object({ id: z.string().uuid(), expectedVersion: z.number().int(), acknowledgedWarnings: z.array(z.string()) }))
  .mutation(async ({ input, ctx }) => {
    const { row, document } = await loadExportInvoice(input.id);
    if (row.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already issued.' });
    if (row.version !== input.expectedVersion) {
      throw new TRPCError({ code: 'CONFLICT', message: 'The document changed. Reload before issuing.' });
    }

    const stale = await findStaleSources(document);
    const checks = validateExportDocument(document, { staleInvoices: stale.map((s) => s.invoiceNumber) });
    const errors = checks.filter((c) => c.level === 'error');
    if (errors.length > 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: errors.map((e) => e.message).join(' ') });
    }
    const unseen = checks.filter((c) => c.level === 'warning' && !input.acknowledgedWarnings.includes(c.code));
    if (unseen.length > 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `New warnings to review: ${unseen.map((c) => c.message).join(' ')}` });
    }

    let number = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      number = await generateExportInvoiceNumber();
      const issued = { ...document, header: { ...document.header, number } };
      const pdf = await renderExportInvoicePDF(issued);
      const version = row.version + 1;
      const blob = await put(`export-invoices/${number}/v${version}.pdf`, pdf, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: true,
      });
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(exportInvoices)
            .set({ number, status: 'issued', document: issued, version, pdfUrl: blob.url, issuedAt: new Date(), updatedAt: new Date() })
            .where(eq(exportInvoices.id, row.id));
          await tx.insert(exportInvoiceVersions).values({
            exportInvoiceId: row.id,
            version,
            document: issued,
            ops: [],
            changeSummary: `Issued as ${number}`,
            pdfUrl: blob.url,
            createdBy: ctx.user.id,
          });
        });
        return { number, pdfUrl: blob.url };
      } catch (error) {
        // Another issue took the number between generating and saving it
        if (attempt === 2) throw error;
      }
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not issue ${number}.` });
  });

export default adminIssue;

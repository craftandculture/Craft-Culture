import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  exportInvoiceVersions,
  exportInvoices,
  logisticsDocuments,
  logisticsJobs,
  logisticsShipmentActivityLogs,
} from '@/database/schema';
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
 * When an export job is linked to it, the PDF is added to that job's documents
 * as its commercial invoice, unless the same file is already there.
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
      // A reopened document is re-issued under the number it already has
      number = row.number ?? (await generateExportInvoiceNumber());
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
            changeSummary: row.number ? `Re-issued ${number} (revised)` : `Issued as ${number}`,
            pdfUrl: blob.url,
            createdBy: ctx.user.id,
          });

          const linkedJobs = await tx
            .select({ shipmentId: logisticsJobs.shipmentId })
            .from(logisticsJobs)
            .where(eq(logisticsJobs.exportInvoiceId, row.id));
          for (const job of linkedJobs) {
            const [existing] = await tx
              .select({ id: logisticsDocuments.id })
              .from(logisticsDocuments)
              .where(and(eq(logisticsDocuments.shipmentId, job.shipmentId), eq(logisticsDocuments.fileUrl, blob.url)));
            if (existing) continue;
            const fileName = `${number}${row.number ? ` v${version}` : ''}.pdf`;
            const [document] = await tx
              .insert(logisticsDocuments)
              .values({
                shipmentId: job.shipmentId,
                documentType: 'commercial_invoice',
                documentNumber: number,
                fileUrl: blob.url,
                fileName,
                fileSize: pdf.length,
                mimeType: 'application/pdf',
                issueDate: new Date(),
                uploadedBy: ctx.user.id,
              })
              .returning({ id: logisticsDocuments.id });
            await tx.insert(logisticsShipmentActivityLogs).values({
              shipmentId: job.shipmentId,
              userId: ctx.user.id,
              action: 'document_uploaded',
              notes: `Export invoice ${number} issued and added: ${fileName}`,
              metadata: { documentId: document?.id, documentType: 'commercial_invoice', exportInvoiceId: row.id },
            });
          }
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

import { TRPCError } from '@trpc/server';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import isUniqueViolation from '@/app/_logistics/utils/isUniqueViolation';
import db from '@/database/client';
import {
  exportInvoiceVersions,
  exportInvoices,
  logisticsDocuments,
  logisticsJobs,
  logisticsShipmentActivityLogs,
} from '@/database/schema';
import { deleteStoredFile, putPrivateFile } from '@/lib/blob/privateFiles';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

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
 * When an export job is linked to it (as its export invoice or one of its
 * additional ones), the PDF is added to that job's documents as its commercial
 * invoice, unless the same file is already there; a re-issued PDF is filed as
 * the next version of the one it replaces.
 *
 * The save checks the version again, so a concurrent edit or issue is refused
 * rather than overwritten. Only a clash on the EXP number is retried, with the
 * next number; a PDF uploaded for an attempt that did not save is removed.
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

    /** Remove a PDF whose save did not go through, so no stray file is left behind */
    const discard = async (url: string) => {
      await deleteStoredFile(url).catch((error: unknown) => {
        logger.error('Could not remove an unsaved export invoice PDF', {
          exportInvoiceId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };

    let number = '';
    // A reopened document keeps its number, so only a new number can clash and be retried
    const attempts = row.number ? 1 : 3;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      number = row.number ?? (await generateExportInvoiceNumber());
      const issued = { ...document, header: { ...document.header, number } };
      const pdf = await renderExportInvoicePDF(issued);
      const version = row.version + 1;
      const blob = await putPrivateFile(`export-invoices/${number}/v${version}.pdf`, pdf, 'application/pdf');
      try {
        await db.transaction(async (tx) => {
          const saved = await tx
            .update(exportInvoices)
            .set({ number, status: 'issued', document: issued, version, pdfUrl: blob.url, issuedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(exportInvoices.id, row.id),
                eq(exportInvoices.version, input.expectedVersion),
                eq(exportInvoices.status, 'draft'),
              ),
            )
            .returning({ id: exportInvoices.id });
          if (saved.length === 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'The document changed. Reload before issuing.' });
          }
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
            .where(
              or(
                eq(logisticsJobs.exportInvoiceId, row.id),
                sql`${row.id}::uuid = ANY(${logisticsJobs.additionalExportInvoiceIds})`,
              ),
            );
          for (const job of linkedJobs) {
            const [existing] = await tx
              .select({ id: logisticsDocuments.id })
              .from(logisticsDocuments)
              .where(and(eq(logisticsDocuments.shipmentId, job.shipmentId), eq(logisticsDocuments.fileUrl, blob.url)));
            if (existing) continue;
            // The PDF this one replaces, when the document is being re-issued
            const [previous] = await tx
              .select({ id: logisticsDocuments.id, version: logisticsDocuments.version })
              .from(logisticsDocuments)
              .where(
                and(
                  eq(logisticsDocuments.shipmentId, job.shipmentId),
                  eq(logisticsDocuments.documentType, 'commercial_invoice'),
                  eq(logisticsDocuments.documentNumber, number),
                ),
              )
              .orderBy(desc(logisticsDocuments.version), desc(logisticsDocuments.createdAt))
              .limit(1);
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
                version: previous ? previous.version + 1 : 1,
                previousVersionId: previous?.id ?? null,
              })
              .returning({ id: logisticsDocuments.id });
            await tx.insert(logisticsShipmentActivityLogs).values({
              shipmentId: job.shipmentId,
              userId: ctx.user.id,
              action: 'document_uploaded',
              notes: previous
                ? `Export invoice ${number} re-issued and added, replacing the earlier PDF: ${fileName}`
                : `Export invoice ${number} issued and added: ${fileName}`,
              metadata: { documentId: document?.id, documentType: 'commercial_invoice', exportInvoiceId: row.id },
            });
          }
        });
        return { number, pdfUrl: blob.url };
      } catch (error) {
        await discard(blob.url);
        // Only a clash on a newly taken number is retried with the next one
        if (!row.number && isUniqueViolation(error) && attempt < attempts - 1) continue;
        if (error instanceof TRPCError) throw error;
        logger.error('Export invoice issue failed', {
          exportInvoiceId: row.id,
          number,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not issue ${number}. Please try again.` });
      }
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not issue ${number}.` });
  });

export default adminIssue;

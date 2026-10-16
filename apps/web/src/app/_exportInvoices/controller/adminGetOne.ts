import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceVersions, logisticsJobs, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import findStaleSources from '../data/findStaleSources';
import loadExportInvoice from '../data/loadExportInvoice';
import validateExportDocument from '../utils/validateExportDocument';

/**
 * One export invoice, with its checks and history
 *
 * The checks are run against Zoho as it is now, so an invoice reissued since
 * the draft was built shows as an error the moment the document is opened.
 * The export job that points at it, if any, is returned so the editor can
 * link back to it.
 */
const adminGetOne = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    const { row, document } = await loadExportInvoice(input.id);
    const stale = row.status === 'draft' ? await findStaleSources(document) : [];
    const [versions, [linkedJob]] = await Promise.all([
      db
      .select({
        version: exportInvoiceVersions.version,
        request: exportInvoiceVersions.request,
        changeSummary: exportInvoiceVersions.changeSummary,
        pdfUrl: exportInvoiceVersions.pdfUrl,
        createdAt: exportInvoiceVersions.createdAt,
        createdByName: users.name,
      })
      .from(exportInvoiceVersions)
      .leftJoin(users, eq(users.id, exportInvoiceVersions.createdBy))
      .where(eq(exportInvoiceVersions.exportInvoiceId, input.id))
      .orderBy(desc(exportInvoiceVersions.version)),
      db
        .select({ shipmentId: logisticsJobs.shipmentId, jobNumber: logisticsJobs.jobNumber })
        .from(logisticsJobs)
        .where(eq(logisticsJobs.exportInvoiceId, input.id))
        .orderBy(desc(logisticsJobs.createdAt))
        .limit(1),
    ]);

    return {
      id: row.id,
      number: row.number,
      status: row.status,
      version: row.version,
      pdfUrl: row.pdfUrl,
      zohoCustomerId: row.zohoCustomerId,
      document,
      stale,
      checks: validateExportDocument(document, { staleInvoices: stale.map((s) => s.invoiceNumber) }),
      versions,
      linkedJob: linkedJob ?? null,
    };
  });

export default adminGetOne;

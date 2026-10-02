import { desc } from 'drizzle-orm';

import db from '@/database/client';
import { exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { exportDocumentSchema } from '../schemas/exportDocumentSchema';
import deriveDocumentTotals from '../utils/deriveDocumentTotals';

/** Export invoices, newest first, with their headline figures */
const adminGetMany = adminProcedure.query(async () => {
  const rows = await db.select().from(exportInvoices).orderBy(desc(exportInvoices.createdAt)).limit(200);
  return rows.map((row) => {
    const parsed = exportDocumentSchema.safeParse(row.document);
    const totals = parsed.success ? deriveDocumentTotals(parsed.data) : null;
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      consigneeName: row.consigneeName,
      invoices: parsed.success ? parsed.data.sources.map((s) => s.invoiceNumber) : [],
      currency: parsed.success ? parsed.data.header.currency : 'AED',
      total: totals?.total ?? null,
      cases: totals?.cases ?? null,
      createdAt: row.createdAt,
      issuedAt: row.issuedAt,
      pdfUrl: row.pdfUrl,
    };
  });
});

export default adminGetMany;

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import { exportDocumentSchema } from '@/app/_exportInvoices/schemas/exportDocumentSchema';
import renderExportInvoicePDF from '@/app/_exportInvoices/utils/renderExportInvoicePDF';
import db from '@/database/client';
import { exportInvoices } from '@/database/schema';

/**
 * Stream an export invoice as a PDF
 *
 * GET /api/admin/export-invoices/[id]/pdf
 *
 * Renders the current document, so a draft can be checked page by page before
 * it is issued. A draft is stamped DRAFT and carries no number.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db.select().from(exportInvoices).where(eq(exportInvoices.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = exportDocumentSchema.safeParse(row.document);
  if (!parsed.success) return NextResponse.json({ error: 'Unreadable document' }, { status: 500 });

  const pdf = await renderExportInvoicePDF(parsed.data);
  const filename = `${row.number ?? 'export-invoice-draft'}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

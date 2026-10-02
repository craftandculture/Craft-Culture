import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { exportInvoices } from '@/database/schema';

import { exportDocumentSchema } from '../schemas/exportDocumentSchema';

/**
 * Load an export invoice and parse its document
 *
 * @param id - The export invoice id
 * @returns The row and its typed document
 */
const loadExportInvoice = async (id: string) => {
  const [row] = await db.select().from(exportInvoices).where(eq(exportInvoices.id, id)).limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Export invoice not found.' });
  const document = exportDocumentSchema.parse(row.document);
  return { row, document };
};

export default loadExportInvoice;

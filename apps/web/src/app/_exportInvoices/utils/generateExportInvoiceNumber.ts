import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { exportInvoices } from '@/database/schema';

/** EXP-2026-0029 to 0041 were issued by hand before this tool existed */
const FIRST_SEQUENCE_2026 = 42;

/**
 * Generate the next export invoice number, EXP-YYYY-NNNN
 *
 * @example
 *   await generateExportInvoiceNumber(); // 'EXP-2026-0042'
 *
 * @returns The next number for this year
 */
const generateExportInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;

  const [last] = await db
    .select({ number: exportInvoices.number })
    .from(exportInvoices)
    .where(sql`${exportInvoices.number} LIKE ${prefix + '%'}`)
    .orderBy(desc(exportInvoices.number))
    .limit(1);

  const lastSequence = last?.number ? parseInt(last.number.split('-')[2] ?? '0', 10) : 0;
  const floor = year === 2026 ? FIRST_SEQUENCE_2026 : 1;
  const sequence = Math.max(lastSequence + 1, floor);

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

export default generateExportInvoiceNumber;

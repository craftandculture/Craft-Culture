import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceSupplierOrders } from '@/database/schema';

/**
 * Generate a unique Supplier Order number in format SO-YYYY-NNNN
 *
 * @example
 *   await generateSupplierOrderNumber(); // returns "SO-2026-0001"
 */
const generateSupplierOrderNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;

  // Get the latest Supplier Order number for this year
  const [latest] = await db
    .select({ orderNumber: sourceSupplierOrders.orderNumber })
    .from(sourceSupplierOrders)
    .where(sql`${sourceSupplierOrders.orderNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(sourceSupplierOrders.orderNumber))
    .limit(1);

  let nextNumber = 1;

  if (latest?.orderNumber) {
    const match = latest.orderNumber.match(/SO-\d{4}-(\d{4})/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

export default generateSupplierOrderNumber;

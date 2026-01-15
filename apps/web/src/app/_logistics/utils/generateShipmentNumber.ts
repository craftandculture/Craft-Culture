import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';

/**
 * Generate a unique shipment number in format SHP-YYYY-NNNN
 *
 * @example
 *   await generateShipmentNumber(); // returns "SHP-2026-0001"
 */
const generateShipmentNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `SHP-${year}-`;

  // Get the latest shipment number for this year
  const [latest] = await db
    .select({ shipmentNumber: logisticsShipments.shipmentNumber })
    .from(logisticsShipments)
    .where(sql`${logisticsShipments.shipmentNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(logisticsShipments.shipmentNumber))
    .limit(1);

  let nextNumber = 1;

  if (latest?.shipmentNumber) {
    const match = latest.shipmentNumber.match(/SHP-\d{4}-(\d{4})/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

export default generateShipmentNumber;

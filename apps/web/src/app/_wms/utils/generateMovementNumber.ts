import db from '@/database/client';
import { wmsStockMovements } from '@/database/schema';

/**
 * Generate a unique movement number for WMS stock movements
 *
 * @example
 *   await generateMovementNumber(); // returns 'MOV-2026-0001'
 *
 * @returns The generated movement number in format MOV-YYYY-NNNN
 */
const generateMovementNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `MOV-${year}-`;

  // Get the highest sequence number for this year
  const result = await db
    .select({ movementNumber: wmsStockMovements.movementNumber })
    .from(wmsStockMovements)
    .where((fields, { like }) => like(fields.movementNumber, `${prefix}%`))
    .orderBy((fields) => fields.movementNumber)
    .limit(1);

  let nextSequence = 1;

  if (result.length > 0 && result[0]) {
    const lastNumber = result[0].movementNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    nextSequence = lastSequence + 1;
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
};

export default generateMovementNumber;

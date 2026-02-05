import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsDeliveryNotes } from '@/database/schema';

/**
 * Generate a unique delivery note number in format: DN-YYYY-NNNN
 * Example: DN-2026-0001
 *
 * @returns The generated delivery note number
 */
const generateDeliveryNoteNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `DN-${year}-`;

  // Get the last delivery note number for this year
  const [lastNote] = await db
    .select({ deliveryNoteNumber: wmsDeliveryNotes.deliveryNoteNumber })
    .from(wmsDeliveryNotes)
    .where(sql`${wmsDeliveryNotes.deliveryNoteNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(wmsDeliveryNotes.deliveryNoteNumber))
    .limit(1);

  let sequence = 1;

  if (lastNote?.deliveryNoteNumber) {
    const lastSequence = parseInt(lastNote.deliveryNoteNumber.split('-')[2] ?? '0', 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

export default generateDeliveryNoteNumber;

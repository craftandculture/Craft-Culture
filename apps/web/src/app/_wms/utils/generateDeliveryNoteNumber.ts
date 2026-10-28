import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next delivery note number (DN-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_delivery_note_number_seq sequence.
 *
 * @example
 *   const number = await generateDeliveryNoteNumber(tx); // "DN-2026-0042"
 */
const generateDeliveryNoteNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'DN',
    table: 'wms_delivery_notes',
    column: 'delivery_note_number',
    sequence: 'wms_delivery_note_number_seq',
  });

export default generateDeliveryNoteNumber;

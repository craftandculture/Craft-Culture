import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next stock movement number (MOV-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_movement_number_seq sequence.
 *
 * @example
 *   const number = await generateMovementNumber(tx); // "MOV-2026-0042"
 */
const generateMovementNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'MOV',
    table: 'wms_stock_movements',
    column: 'movement_number',
    sequence: 'wms_movement_number_seq',
  });

export default generateMovementNumber;

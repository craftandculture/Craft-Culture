import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next pick list number (PL-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_pick_list_number_seq sequence.
 *
 * @example
 *   const number = await generatePickListNumber(tx); // "PL-2026-0042"
 */
const generatePickListNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'PL',
    table: 'wms_pick_lists',
    column: 'pick_list_number',
    sequence: 'wms_pick_list_number_seq',
  });

export default generatePickListNumber;

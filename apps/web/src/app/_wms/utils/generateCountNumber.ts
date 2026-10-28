import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next cycle count number (CC-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_count_number_seq sequence.
 *
 * @example
 *   const number = await generateCountNumber(tx); // "CC-2026-0042"
 */
const generateCountNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'CC',
    table: 'wms_cycle_counts',
    column: 'count_number',
    sequence: 'wms_count_number_seq',
  });

export default generateCountNumber;

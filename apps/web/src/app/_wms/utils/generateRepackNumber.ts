import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next repack number (RPK-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_repack_number_seq sequence.
 *
 * @example
 *   const number = await generateRepackNumber(tx); // "RPK-2026-0042"
 */
const generateRepackNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'RPK',
    table: 'wms_repacks',
    column: 'repack_number',
    sequence: 'wms_repack_number_seq',
  });

export default generateRepackNumber;

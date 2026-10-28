import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next dispatch batch number (BATCH-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_batch_number_seq sequence.
 *
 * @example
 *   const number = await generateBatchNumber(tx); // "BATCH-2026-0042"
 */
const generateBatchNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'BATCH',
    table: 'wms_dispatch_batches',
    column: 'batch_number',
    sequence: 'wms_batch_number_seq',
  });

export default generateBatchNumber;

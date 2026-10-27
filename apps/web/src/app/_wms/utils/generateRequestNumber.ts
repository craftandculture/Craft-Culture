import nextDocumentNumber, { type DbExecutor } from './nextDocumentNumber';

/**
 * Generate the next partner request number (REQ-YYYY-NNNN)
 *
 * Pass the transaction the row is inserted in, so numbers taken earlier in the
 * same transaction are seen. Collision-free via the wms_request_number_seq sequence.
 *
 * @example
 *   const number = await generateRequestNumber(tx); // "REQ-2026-0042"
 */
const generateRequestNumber = async (executor?: DbExecutor) =>
  nextDocumentNumber({
    executor,
    code: 'REQ',
    table: 'wms_partner_requests',
    column: 'request_number',
    sequence: 'wms_request_number_seq',
  });

export default generateRequestNumber;

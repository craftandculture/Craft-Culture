/**
 * The order-level manual-invoicing label, from its lines
 *
 * - Any line delivered and not yet invoiced: "Delivered – Manual Invoice
 *   Pending".
 * - Every recorded line invoiced: "Delivered – Invoiced".
 * - When not every line has been delivered yet, the label says how many, so a
 *   part delivery reads as one: "(3 of 5 lines)".
 *
 * @example
 *   describeInvoicing({ lines: 5, pending: 2, invoiced: 1 });
 *   // { state: 'pending', label: 'Delivered – Manual Invoice Pending (3 of 5 lines)' }
 *
 * @param counts - Lines on the order, and how many are pending or invoiced
 * @returns null when nothing has been marked delivered
 */
const describeInvoicing = ({
  lines,
  pending,
  invoiced,
}: {
  lines: number;
  pending: number;
  invoiced: number;
}) => {
  const delivered = pending + invoiced;
  if (delivered === 0) return null;

  const part = delivered < lines ? ` (${delivered} of ${lines} lines)` : '';

  return pending > 0
    ? { state: 'pending' as const, label: `Delivered – Manual Invoice Pending${part}` }
    : { state: 'invoiced' as const, label: `Delivered – Invoiced${part}` };
};

export default describeInvoicing;

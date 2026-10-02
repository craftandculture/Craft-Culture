import roundMoney from './roundMoney';
import type { ExportDocument } from '../schemas/exportDocumentSchema';

/**
 * Work out the figures the document prints but never stores
 *
 * Cases are the Qty column, because every line is counted in cartons; bottles
 * follow from the pack; the total is the lines. Keeping these derived is what
 * stops the header disagreeing with the table.
 *
 * @param doc - The export document
 * @returns Totals, bottles by size, and the expected total from the invoices
 */
const deriveDocumentTotals = (doc: ExportDocument) => {
  const cases = doc.lines.reduce((sum, l) => sum + l.qty, 0);
  const bottlesBySize = new Map<number, number>();
  for (const l of doc.lines) {
    bottlesBySize.set(l.bottleSizeCl, (bottlesBySize.get(l.bottleSizeCl) ?? 0) + l.qty * l.packBottles);
  }
  const bottles = [...bottlesBySize.values()].reduce((a, b) => a + b, 0);
  const total = roundMoney(doc.lines.reduce((sum, l) => sum + l.amount, 0));
  const invoicesUsd = roundMoney(doc.sources.reduce((sum, s) => sum + s.totalUsd, 0));
  const expectedTotal = roundMoney(invoicesUsd * doc.header.rate);

  return {
    cases,
    declaredCases: doc.header.casesOverride ?? cases,
    bottles,
    bottlesBySize: [...bottlesBySize.entries()].sort((a, b) => a[0] - b[0]),
    total,
    invoicesUsd,
    expectedTotal,
  };
};

export default deriveDocumentTotals;

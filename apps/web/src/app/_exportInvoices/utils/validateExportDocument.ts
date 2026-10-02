import deriveDocumentTotals from './deriveDocumentTotals';
import roundMoney from './roundMoney';
import type { ExportDocument } from '../schemas/exportDocumentSchema';

export interface ExportCheck {
  level: 'error' | 'warning';
  code: string;
  message: string;
  lineIds?: string[];
}

/**
 * Check an export document before it can be issued
 *
 * Errors block issuing; warnings must be read. Every check here is something
 * that was got wrong by hand on an earlier export invoice: a total that no
 * longer matched a reissued invoice, a Qty column that did not add up to the
 * cases, a line without a BOE, stock that belonged to someone else, a price
 * changed on the document but not in Zoho.
 *
 * @example
 *   const checks = validateExportDocument(doc, { staleInvoices: [] });
 *   const canIssue = !checks.some((c) => c.level === 'error');
 *
 * @param doc - The export document
 * @param context - Facts from outside the document, such as revised invoices
 * @returns The failed checks, errors first
 */
const validateExportDocument = (
  doc: ExportDocument,
  context: { staleInvoices?: string[] } = {},
) => {
  const checks: ExportCheck[] = [];
  const totals = deriveDocumentTotals(doc);
  const overridden = doc.lines.filter((l) => l.override);

  // Per-line rounding to the fil can drift from a one-shot conversion
  const allowance = roundMoney(doc.lines.length * 0.01);
  const drift = roundMoney(totals.total - totals.expectedTotal);
  if (Math.abs(drift) > allowance) {
    const message = `The lines total ${doc.header.currency} ${totals.total.toFixed(2)} but the invoices come to ${doc.header.currency} ${totals.expectedTotal.toFixed(2)} (USD ${totals.invoicesUsd.toFixed(2)} × ${doc.header.rate}).`;
    checks.push(
      overridden.length > 0
        ? {
            level: 'warning',
            code: 'total_differs_by_override',
            message: `${message} The difference comes from lines changed on this document; reissue the invoices in Zoho so the two agree.`,
            lineIds: overridden.map((l) => l.id),
          }
        : { level: 'error', code: 'total_mismatch', message },
    );
  }

  if (doc.header.casesOverride !== null && doc.header.casesOverride !== totals.cases) {
    checks.push({
      level: 'warning',
      code: 'cases_override',
      message: `Total Cases is set to ${doc.header.casesOverride}, but the Qty column adds up to ${totals.cases}.`,
    });
  }

  const noBoe = doc.lines.filter((l) => !l.boe);
  if (noBoe.length > 0) {
    checks.push({
      level: 'error',
      code: 'missing_boe',
      message: `${noBoe.length} line${noBoe.length > 1 ? 's have' : ' has'} no re-export BOE.`,
      lineIds: noBoe.map((l) => l.id),
    });
  }

  const badRows = doc.lines.filter((l) => Math.abs(roundMoney(l.unitPrice * l.qty) - l.amount) > 0.01);
  if (badRows.length > 0) {
    checks.push({
      level: 'error',
      code: 'row_does_not_multiply',
      message: 'Unit price × Qty does not equal the amount on some lines.',
      lineIds: badRows.map((l) => l.id),
    });
  }

  for (const inv of context.staleInvoices ?? []) {
    checks.push({
      level: 'error',
      code: 'invoice_revised',
      message: `${inv} has changed in Zoho since this document was built. Refresh from Zoho before issuing.`,
    });
  }

  if (overridden.length > 0) {
    checks.push({
      level: 'warning',
      code: 'differs_from_zoho',
      message: `${overridden.length} line${overridden.length > 1 ? 's differ' : ' differs'} from the Zoho invoice (${overridden.map((l) => l.override?.reason).join('; ')}). Reissue the invoice in Zoho so customs see one figure.`,
      lineIds: overridden.map((l) => l.id),
    });
  }

  const otherOwner = doc.lines.filter(
    (l) =>
      l.boe &&
      l.boeOwnerName &&
      l.source.ownerName &&
      l.boeOwnerName.toLowerCase() !== l.source.ownerName.toLowerCase(),
  );
  if (otherOwner.length > 0) {
    checks.push({
      level: 'warning',
      code: 'stock_other_owner',
      message: `${otherOwner.length} line${otherOwner.length > 1 ? 's take' : ' takes'} its BOE from stock held for another owner. Confirm the wine can ship on this order.`,
      lineIds: otherOwner.map((l) => l.id),
    });
  }

  const later = doc.sources.filter((s) => s.invoiceDate > doc.header.date);
  if (later.length > 0) {
    checks.push({
      level: 'warning',
      code: 'invoice_after_document',
      message: `${later.map((s) => s.invoiceNumber).join(', ')} ${later.length > 1 ? 'are' : 'is'} dated after this export invoice.`,
    });
  }

  const noOrigin = doc.lines.filter((l) => !l.origin.trim());
  if (noOrigin.length > 0) {
    checks.push({
      level: 'warning',
      code: 'missing_origin',
      message: `${noOrigin.length} line${noOrigin.length > 1 ? 's have' : ' has'} no country of origin.`,
      lineIds: noOrigin.map((l) => l.id),
    });
  }

  if (doc.header.pallets === null) {
    checks.push({ level: 'warning', code: 'missing_pallets', message: 'Enter the number of pallets.' });
  }

  return checks.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
};

export default validateExportDocument;

'use client';

import type { ExportDocument } from '../schemas/exportDocumentSchema';
import deriveDocumentTotals from '../utils/deriveDocumentTotals';

export interface ExportSummaryStripProps {
  document: ExportDocument;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * The figures customs read first, above the lines
 *
 * The same strip as the PDF's details row, so the operator checks the
 * headline numbers before the detail. Missing figures are shown as gaps.
 */
const ExportSummaryStrip = ({ document: doc }: ExportSummaryStripProps) => {
  const t = deriveDocumentTotals(doc);
  const h = doc.header;
  const items: { label: string; value: string; missing?: boolean }[] = [
    { label: 'Invoices', value: String(doc.sources.length) },
    { label: 'Cases', value: String(t.declaredCases) },
    { label: 'Bottles', value: String(t.bottles) },
    { label: 'Pallets', value: h.pallets === null ? 'Enter' : String(h.pallets), missing: h.pallets === null },
    {
      label: h.grossWeightEstimated ? 'Weight (est.)' : 'Weight',
      value: h.grossWeightKg === null ? 'Enter' : `${h.grossWeightKg} kg`,
      missing: h.grossWeightKg === null,
    },
    { label: `Total ${h.currency}`, value: money(t.total) },
  ];

  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border-muted bg-border-muted sm:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-fill-primary px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">{item.label}</p>
          <p className={`text-sm font-semibold tabular-nums ${item.missing ? 'text-text-warning' : ''}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
};

export default ExportSummaryStrip;

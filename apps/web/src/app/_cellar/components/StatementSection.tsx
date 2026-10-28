import { format } from 'date-fns';

export interface StatementSectionProps {
  title: string;
  empty: string;
  /** Heading of the right-hand column */
  valueLabel?: string;
  rows: {
    key: string;
    date: Date | string | null;
    name: string;
    /** Vintage and bottle, under the name */
    detail?: string;
    /** How it came about, where the section title does not already say */
    note?: string;
    value: string;
  }[];
  footer?: string;
}

/**
 * One section of the statement: a dated table, or a line saying there was nothing
 *
 * Laid out as a ledger rather than a list of cards: date, wine, quantity in
 * fixed columns read down a printed page the way a collector checks a
 * statement against their own records.
 */
const StatementSection = ({
  title,
  empty,
  valueLabel = 'Bottles',
  rows,
  footer,
}: StatementSectionProps) => (
  <section className="mb-7">
    <h2 className="text-text-muted mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider">
      {title}
    </h2>
    {rows.length === 0 ? (
      <p className="text-text-muted border-border-muted border-t px-1 pt-2 text-sm">{empty}</p>
    ) : (
      <div className="border-border-muted bg-surface-primary overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-fill-muted/60 border-border-muted border-b">
            <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
              <th className="w-20 px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Wine</th>
              <th className="px-3 py-2 text-right">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-border-muted divide-y">
            {rows.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="text-text-muted whitespace-nowrap px-3 py-2 text-xs tabular-nums">
                  {row.date ? format(new Date(row.date), 'd MMM') : ''}
                </td>
                <td className="px-3 py-2">
                  <span className="text-text-primary block font-medium">{row.name}</span>
                  {(row.detail || row.note) && (
                    <span className="text-text-muted block text-xs">
                      {[row.detail, row.note].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="text-text-primary whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {footer && <p className="text-text-primary mt-2 text-sm font-semibold">{footer}</p>}
  </section>
);

export default StatementSection;

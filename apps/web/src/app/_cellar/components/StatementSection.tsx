import { format } from 'date-fns';

export interface StatementSectionProps {
  title: string;
  empty: string;
  rows: {
    key: string;
    date: Date | string | null;
    name: string;
    note: string;
    value: string;
  }[];
  footer?: string;
}

/** One section of the statement: a dated list, or a line saying there was nothing */
const StatementSection = ({ title, empty, rows, footer }: StatementSectionProps) => (
  <section className="mb-6">
    <h2 className="text-text-muted mb-2 text-[11px] font-semibold uppercase tracking-wider">
      {title}
    </h2>
    {rows.length === 0 ? (
      <p className="text-text-muted border-border-muted rounded-xl border px-4 py-3 text-sm">
        {empty}
      </p>
    ) : (
      <ul className="border-border-muted divide-border-muted divide-y overflow-hidden rounded-xl border">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {row.name}
              </span>
              <span className="text-text-muted block text-xs">
                {row.date ? `${format(new Date(row.date), 'd MMM')} · ` : ''}
                {row.note}
              </span>
            </span>
            <span className="text-text-primary flex-shrink-0 text-sm tabular-nums">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    )}
    {footer && <p className="text-text-primary mt-2 text-sm font-semibold">{footer}</p>}
  </section>
);

export default StatementSection;

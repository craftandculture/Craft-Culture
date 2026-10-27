import { IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';

export interface StatementGroup {
  key: string;
  label: string;
  /** "Delivered", "On its way"; shown as a pill */
  status?: string | null;
  date: Date | string | null;
  /** Money for the whole group, when known */
  amount?: string | null;
  wines: {
    key: string;
    name: string;
    detail?: string;
    bottles: number;
    amount?: string | null;
  }[];
}

export interface StatementGroupsProps {
  title: string;
  empty: string;
  groups: StatementGroup[];
  footer?: string;
}

const bottles = (count: number) => `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

/**
 * One section of the statement as orders rather than single wines
 *
 * A month with one delivery and one sale of seventeen wines read as eighty
 * lines. Each order is now a single line (who, when, how many) that opens to
 * its wines, so the shape of the month is visible at a glance and the detail
 * is one tap away. Printing opens every group.
 */
const StatementGroups = ({ title, empty, groups, footer }: StatementGroupsProps) => (
  <section className="mb-6">
    <h2 className="text-text-muted mb-2 text-[11px] font-semibold uppercase tracking-wider">
      {title}
    </h2>
    {groups.length === 0 ? (
      <p className="text-text-muted border-border-muted rounded-xl border px-4 py-3 text-sm">
        {empty}
      </p>
    ) : (
      <div className="border-border-muted divide-border-muted divide-y overflow-hidden rounded-xl border">
        {groups.map((group) => {
          const total = group.wines.reduce((sum, wine) => sum + wine.bottles, 0);

          return (
            <details key={group.key} className="statement-group group">
              <summary className="hover:bg-fill-muted/40 flex cursor-pointer list-none items-start gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                <IconChevronRight
                  size={16}
                  className="text-text-muted mt-0.5 shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="text-text-primary block font-medium">{group.label}</span>
                  <span className="text-text-muted block text-xs">
                    {[
                      group.date ? format(new Date(group.date), 'd MMMM') : null,
                      `${group.wines.length} ${group.wines.length === 1 ? 'wine' : 'wines'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {group.status && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      group.status === 'Delivered'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-fill-muted text-text-primary'
                    }`}
                  >
                    {group.status}
                  </span>
                )}
                <span className="shrink-0 text-right">
                  <span className="text-text-primary block font-semibold tabular-nums">
                    {bottles(total)}
                  </span>
                  {group.amount && (
                    <span className="text-text-muted block text-xs tabular-nums">{group.amount}</span>
                  )}
                </span>
              </summary>
              <table className="w-full text-sm">
                <tbody className="divide-border-muted bg-fill-muted/20 divide-y">
                  {group.wines.map((wine) => (
                    <tr key={wine.key} className="align-top">
                      <td className="py-2 pl-10 pr-3">
                        <span className="text-text-primary block">{wine.name}</span>
                        {wine.detail && (
                          <span className="text-text-muted block text-xs">{wine.detail}</span>
                        )}
                      </td>
                      <td className="text-text-primary whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {wine.bottles}
                        {wine.amount && (
                          <span className="text-text-muted block text-xs">{wine.amount}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    )}
    {footer && <p className="text-text-primary mt-2 text-sm font-semibold">{footer}</p>}
  </section>
);

export default StatementGroups;

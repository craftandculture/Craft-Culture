import { IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';

export interface StatementGroup {
  key: string;
  label: string;
  /** "Delivered", "On its way"; shown as a dot and a word */
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
  /** The section's total, beside its title */
  total?: string;
  footer?: string;
}

const bottles = (count: number) => `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

/** Order numbers read as reference, not as part of who the order was for */
const REFERENCE = /^(PCO|SO|INV)-[\d-]+$/;

const splitLabel = (label: string) => {
  // Under the Sold heading, "Sold to" only repeats it: the buyer is the line
  const parts = label.replace(/^Sold to /, '').split(' · ');
  return {
    title: parts.filter((part) => !REFERENCE.test(part)).join(' · '),
    references: parts.filter((part) => REFERENCE.test(part)),
  };
};

/**
 * One section of the statement as orders rather than single wines
 *
 * A month with one delivery and one sale of seventeen wines read as eighty
 * lines. Each order is now a single line (who, when, how many) that opens to
 * its wines, so the shape of the month is visible at a glance and the detail
 * is one tap away. Where an order carries money, the money leads and the
 * bottle count sits beneath it. Printing opens every group.
 */
const StatementGroups = ({ title, empty, groups, total, footer }: StatementGroupsProps) => (
  <section className="mb-7">
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">{title}</h2>
      {total && groups.length > 0 && (
        <span className="text-text-primary text-sm font-semibold tabular-nums">{total}</span>
      )}
    </div>
    {groups.length === 0 ? (
      <p className="text-text-muted border-border-muted border-t px-1 pt-2 text-sm">{empty}</p>
    ) : (
      <div className="border-border-muted bg-surface-primary divide-border-muted divide-y overflow-hidden rounded-xl border">
        {groups.map((group) => {
          const count = group.wines.reduce((sum, wine) => sum + wine.bottles, 0);
          const { title: label, references } = splitLabel(group.label);

          return (
            <details key={group.key} className="statement-group group">
              <summary className="hover:bg-fill-muted/40 flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 group-open:bg-fill-muted/30 [&::-webkit-details-marker]:hidden">
                <IconChevronRight
                  size={14}
                  className="text-text-muted shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="text-text-primary block truncate text-sm font-medium">{label}</span>
                  <span className="text-text-muted block text-xs">
                    {[
                      group.date ? format(new Date(group.date), 'd MMMM') : null,
                      `${group.wines.length} ${group.wines.length === 1 ? 'wine' : 'wines'}`,
                      ...references,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {group.status && (
                  <span className="text-text-muted hidden shrink-0 items-center gap-1.5 text-xs sm:inline-flex">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        group.status === 'Delivered' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      aria-hidden
                    />
                    {group.status}
                  </span>
                )}
                <span className="shrink-0 text-right tabular-nums">
                  {group.amount ? (
                    <>
                      <span className="text-text-primary block text-sm font-semibold">{group.amount}</span>
                      <span className="text-text-muted block text-xs">{bottles(count)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-text-primary block text-sm font-semibold">{bottles(count)}</span>
                      {group.status && (
                        <span className="text-text-muted block text-xs sm:hidden">{group.status}</span>
                      )}
                    </>
                  )}
                </span>
              </summary>
              <table className="w-full text-sm">
                <tbody className="divide-border-muted bg-fill-muted/20 divide-y">
                  {group.wines.map((wine) => (
                    <tr key={wine.key} className="align-top">
                      <td className="py-2 pl-9 pr-3">
                        <span className="text-text-primary block">{wine.name}</span>
                        {wine.detail && <span className="text-text-muted block text-xs">{wine.detail}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {wine.amount ? (
                          <>
                            <span className="text-text-primary block">{wine.amount}</span>
                            <span className="text-text-muted block text-xs">{bottles(wine.bottles)}</span>
                          </>
                        ) : (
                          <span className="text-text-primary block">{bottles(wine.bottles)}</span>
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
    {footer && <p className="text-text-primary mt-2 px-1 text-sm font-semibold">{footer}</p>}
  </section>
);

export default StatementGroups;

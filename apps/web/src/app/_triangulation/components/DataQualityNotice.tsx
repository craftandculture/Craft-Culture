'use client';

import { IconAlertTriangle, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';

export interface DataQualityIssue {
  /** Two or three words for the collapsed row */
  label: string;
  /** The full explanation, shown only when expanded */
  detail: string;
  severity: 'blocking' | 'caution';
}

export interface DataQualityNoticeProps {
  issues: DataQualityIssue[];
}

/**
 * What to know before trusting the figures, without a wall of prose
 *
 * These caveats are load-bearing — a variance read off an incomplete map is
 * worse than no variance — but eight paragraphs of them is a wall people learn
 * to skip, which defeats the purpose. Collapsed, each issue is two or three
 * scannable words; the reasoning is one click away for whoever needs it.
 *
 * `blocking` means the figures are wrong until it is fixed; `caution` means
 * they are readable with a caveat. Severity carries an icon and a word, never
 * colour alone.
 */
const DataQualityNotice = ({ issues }: DataQualityNoticeProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (issues.length === 0) {
    return null;
  }

  const blocking = issues.filter((issue) => issue.severity === 'blocking');

  return (
    <div className="border-border-warning/40 bg-fill-warning/10 rounded-xl border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        onClick={() => setIsOpen((current) => !current)}
      >
        <IconAlertTriangle className="text-text-warning size-4 shrink-0" />
        <Typography variant="labelSm" colorRole="warning">
          {blocking.length > 0
            ? `${blocking.length} thing${blocking.length === 1 ? '' : 's'} to fix before reading these figures`
            : `${issues.length} caveat${issues.length === 1 ? '' : 's'}`}
        </Typography>
        <div className="flex flex-wrap items-center gap-1.5">
          {issues.map((issue) => (
            <span
              key={issue.label}
              className={`rounded-full px-2 py-0.5 text-xs ${
                issue.severity === 'blocking'
                  ? 'bg-fill-warning/25 text-text-warning'
                  : 'bg-fill-muted/40 text-text-muted'
              }`}
            >
              {issue.label}
            </span>
          ))}
        </div>
        <span className="text-text-muted ml-auto flex shrink-0 items-center gap-1 text-xs">
          {isOpen ? 'Hide' : 'Why'}
          {isOpen ? (
            <IconChevronDown className="size-3.5" />
          ) : (
            <IconChevronRight className="size-3.5" />
          )}
        </span>
      </button>

      {isOpen ? (
        <ul className="border-border-warning/20 space-y-2 border-t px-4 py-3">
          {issues.map((issue) => (
            <li key={issue.label}>
              <Typography variant="bodyXs" asChild>
                <p>
                  <span
                    className={
                      issue.severity === 'blocking'
                        ? 'text-text-warning font-medium'
                        : 'text-text-muted font-medium'
                    }
                  >
                    {issue.label}
                  </span>{' '}
                  <span className="text-text-muted">{issue.detail}</span>
                </p>
              </Typography>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default DataQualityNotice;

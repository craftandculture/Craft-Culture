'use client';

import { IconBug, IconChevronDown, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { ChangelogDay } from '@/utils/groupChangelogByDay';

interface DayEntryProps {
  day: ChangelogDay;
  isLatest?: boolean;
}

/**
 * Format a changelog date as "Tue 27 Oct 2026"
 */
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * One day of releases in the development log, collapsible
 */
const DayEntry = ({ day, isLatest = false }: DayEntryProps) => {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  const features = day.entries.filter((e) => e.type === 'feature').length;
  const fixes = day.entries.filter((e) => e.type === 'fix').length;
  const range =
    day.firstVersion === day.lastVersion
      ? `v${day.lastVersion}`
      : `v${day.firstVersion} – v${day.lastVersion}`;
  const milestone = [day.firstVersion, day.lastVersion].find((v) => v.endsWith('.0'));

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fill-secondary/50"
      >
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${
            isLatest ? 'bg-emerald-500' : 'bg-border-primary'
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Typography variant="bodySm" className="font-semibold">
              {formatDate(day.date)}
            </Typography>
            {milestone && (
              <span className="rounded-full border border-border-primary px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                Version {milestone.replace(/\.0$/, '')}
              </span>
            )}
          </div>
          <Typography variant="bodyXs" colorRole="muted" className="font-mono">
            {range} · {day.releaseCount} {day.releaseCount === 1 ? 'release' : 'releases'}
          </Typography>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {features > 0 && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <IconSparkles size={13} />
              {features}
            </span>
          )}
          {fixes > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <IconBug size={13} />
              {fixes}
            </span>
          )}
          <IconChevronDown
            size={16}
            className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isExpanded && day.entries.length > 0 && (
        <ul className="space-y-2 px-4 pb-4 pl-9">
          {day.entries.map((entry, index) => (
            <li key={`${entry.version}-${index}`} className="flex items-start gap-2 text-[13px]">
              <Icon
                icon={entry.type === 'feature' ? IconSparkles : IconBug}
                size="xs"
                className={`mt-0.5 shrink-0 ${
                  entry.type === 'feature' ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
              <span className="min-w-0 flex-1 text-text-secondary">
                {entry.description}
                {entry.scope && (
                  <span className="ml-1.5 text-[11px] text-text-muted">· {entry.scope}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-text-muted">
                {entry.version}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DayEntry;

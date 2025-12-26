'use client';

import { IconBug, IconChevronDown, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { ChangelogVersion } from '@/utils/parseChangelog';

interface VersionEntryProps {
  version: ChangelogVersion;
  isLatest?: boolean;
}

/**
 * Format a date string to a more readable format
 */
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Collapsible version entry for the development log
 */
const VersionEntry = ({ version, isLatest = false }: VersionEntryProps) => {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  const features = version.entries.filter((e) => e.type === 'feature');
  const fixes = version.entries.filter((e) => e.type === 'fix');
  const totalChanges = features.length + fixes.length;

  return (
    <div className="group">
      {/* Version Header - Clickable */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-fill-secondary/50"
      >
        {/* Timeline dot */}
        <div
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            isLatest
              ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
              : 'bg-border-primary'
          }`}
        />

        {/* Version & Date */}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <Typography
            variant="bodySm"
            className={`font-mono font-semibold ${
              isLatest ? 'text-emerald-600 dark:text-emerald-400' : ''
            }`}
          >
            v{version.version}
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            {formatDate(version.date)}
          </Typography>
          {isLatest && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Latest
            </span>
          )}
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2">
          {features.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <IconSparkles size={12} />
              {features.length}
            </span>
          )}
          {fixes.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <IconBug size={12} />
              {fixes.length}
            </span>
          )}
          <IconChevronDown
            size={16}
            className={`text-text-muted transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && totalChanges > 0 && (
        <div className="ml-5 border-l border-border-primary pl-4 pt-1">
          <div className="space-y-3 pb-3">
            {/* Features */}
            {features.length > 0 && (
              <div className="space-y-1">
                {features.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-[13px] text-text-secondary"
                  >
                    <Icon
                      icon={IconSparkles}
                      size="xs"
                      className="mt-0.5 shrink-0 text-emerald-500"
                    />
                    <span>{entry.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fixes */}
            {fixes.length > 0 && (
              <div className="space-y-1">
                {fixes.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-[13px] text-text-secondary"
                  >
                    <Icon
                      icon={IconBug}
                      size="xs"
                      className="mt-0.5 shrink-0 text-amber-500"
                    />
                    <span>{entry.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionEntry;

'use client';

import type { ExportCheck } from '../utils/validateExportDocument';

export interface ExportChecksPanelProps {
  checks: ExportCheck[];
  onSelectLines?: (lineIds: string[]) => void;
}

/**
 * The checks an export invoice must pass
 *
 * Errors stop it being issued; warnings must be read. A check that names
 * lines can be clicked to highlight and scroll to them.
 */
const ExportChecksPanel = ({ checks, onSelectLines }: ExportChecksPanelProps) => {
  if (checks.length === 0) {
    return (
      <p className="rounded-lg border border-border-success/30 bg-fill-success/10 px-3 py-2.5 text-sm text-text-success">
        All checks pass.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {checks.map((c) => {
        const clickable = Boolean(c.lineIds?.length && onSelectLines);
        return (
          <li key={`${c.code}-${c.message}`}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => c.lineIds && onSelectLines?.(c.lineIds)}
              className={`w-full rounded-lg border-l-4 px-3 py-2 text-left text-xs leading-snug ${
                c.level === 'error'
                  ? 'border-l-border-danger bg-fill-danger/10 text-text-danger'
                  : 'border-l-border-warning bg-fill-warning/10 text-text-warning'
              } ${clickable ? 'hover:brightness-95' : 'cursor-default'}`}
            >
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide">{c.level}</span>
              {c.message}
              {clickable && <span className="mt-1 block text-[10px] underline">Show the line{c.lineIds && c.lineIds.length > 1 ? 's' : ''}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ExportChecksPanel;

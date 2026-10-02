'use client';

import type { ExportCheck } from '../utils/validateExportDocument';

export interface ExportChecksPanelProps {
  checks: ExportCheck[];
  onSelectLines?: (lineIds: string[]) => void;
}

/**
 * The checks an export invoice must pass, beside the document
 *
 * Errors stop it being issued; warnings must be read. Clicking a check that
 * names lines highlights them in the table.
 */
const ExportChecksPanel = ({ checks, onSelectLines }: ExportChecksPanelProps) => {
  if (checks.length === 0) {
    return (
      <div className="rounded-lg border border-border-success/30 bg-fill-success/10 p-3 text-sm text-text-success">
        All checks pass.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li key={`${c.code}-${c.message}`}>
          <button
            type="button"
            onClick={() => c.lineIds && onSelectLines?.(c.lineIds)}
            className={`w-full rounded-lg border p-2.5 text-left text-xs ${
              c.level === 'error'
                ? 'border-border-danger/30 bg-fill-danger/10 text-text-danger'
                : 'border-border-warning/30 bg-fill-warning/10 text-text-warning'
            }`}
          >
            <span className="font-semibold uppercase">{c.level}</span> · {c.message}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default ExportChecksPanel;

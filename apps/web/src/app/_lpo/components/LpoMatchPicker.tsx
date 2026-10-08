'use client';

import { useState } from 'react';

export interface LpoMatchPickerProps {
  /** The closest wines we hold, as the matcher scored them */
  shortlist: {
    lwin18: string;
    wine: string;
    vintage?: string;
    bottles?: number;
  }[];
  /** The LWIN already on the line, offered as the starting text */
  current?: string | null;
  onChoose: (lwin18: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

/**
 * Say which wine a line means, when the reading got it wrong or gave up.
 *
 * The shortlist covers the usual case — the right wine scored second. A typed
 * LWIN covers the rest, because a code copied off the Stock Explorer is faster
 * than a name and cannot be misread.
 *
 * @param props - The candidates and what to do with the choice
 * @returns An inline chooser
 */
const LpoMatchPicker = ({
  shortlist,
  current,
  onChoose,
  onCancel,
  disabled = false,
}: LpoMatchPickerProps) => {
  const [typed, setTyped] = useState(current ?? '');
  const valid = /^[\dA-Z]+-[\dA-Z]{4}-\d{2}-\d{5}$/i.test(typed.trim());

  return (
    <div className="mt-1 space-y-1.5 rounded-md border border-border-muted bg-fill-secondary/40 p-2 text-[12px]">
      {shortlist.length > 0 && (
        <select
          defaultValue=""
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value) onChoose(event.target.value);
          }}
          className="w-full rounded border border-border-muted bg-background-primary px-1.5 py-1"
        >
          <option value="">Choose from the closest wines…</option>
          {shortlist.map((row) => (
            <option key={row.lwin18} value={row.lwin18}>
              {row.wine}
              {row.vintage ? ` ${row.vintage}` : ''} · {row.lwin18}
              {row.bottles !== undefined ? ` · ${row.bottles} btl` : ''}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-1.5">
        <input
          value={typed}
          disabled={disabled}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && valid) onChoose(typed.trim());
          }}
          placeholder="or paste an LWIN18, e.g. 1012781-2013-06-01500"
          className="min-w-0 flex-1 rounded border border-border-muted bg-background-primary px-1.5 py-1 font-mono text-[11px]"
        />
        <button
          type="button"
          disabled={disabled || !valid}
          onClick={() => onChoose(typed.trim())}
          className="rounded bg-text-primary px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
        >
          Use
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-1 text-[11px] text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default LpoMatchPicker;

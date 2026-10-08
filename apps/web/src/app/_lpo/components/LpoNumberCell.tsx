'use client';

import { useEffect, useState } from 'react';

export interface LpoNumberCellProps {
  value: number;
  /** Decimal places shown and accepted — 0 for a quantity, 2 for a price */
  decimals?: number;
  /** Called with the new number once it is committed and actually changed */
  onCommit: (value: number) => void;
  disabled?: boolean;
  /** Marks the cell as changed here rather than read off the document */
  edited?: boolean;
  title?: string;
}

/**
 * A figure in the order table that can be corrected in place.
 *
 * Committed on Enter or when the cell loses focus, not on every keystroke:
 * each commit reads the order again, and typing "120" should not ask three
 * questions on the way.
 *
 * @param props - The value, its precision and what to do with a new one
 * @returns An inline number input
 */
const LpoNumberCell = ({
  value,
  decimals = 0,
  onCommit,
  disabled = false,
  edited = false,
  title,
}: LpoNumberCellProps) => {
  const shown = value.toFixed(decimals);
  const [draft, setDraft] = useState(shown);

  // A fresh reading of the order replaces whatever was typed
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const next = Number(draft.replace(/,/g, ''));
    const valid =
      Number.isFinite(next) && next >= 0 && (decimals > 0 || Number.isInteger(next));

    if (!valid || next.toFixed(decimals) === shown) {
      setDraft(shown);
      return;
    }

    onCommit(next);
  };

  return (
    <input
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      title={title}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(shown);
          event.currentTarget.blur();
        }
      }}
      className={`w-full min-w-[4.5rem] rounded border px-1.5 py-0.5 text-right tabular-nums hover:border-border-muted focus:border-text-brand focus:outline-none disabled:opacity-60 ${
        edited
          ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
          : 'border-transparent bg-transparent'
      }`}
    />
  );
};

export default LpoNumberCell;

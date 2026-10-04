'use client';

import { useEffect, useRef, useState } from 'react';

import DueChip from './DueChip';
import useTaskMutations from '../hooks/useTaskMutations';
import type { PartState } from '../utils/partState';
import quickDue, { type QuickDue } from '../utils/quickDue';

interface DueMenuProps {
  partId: string;
  due: string | null;
  state: PartState;
  today: string;
  /** Urgent jobs cannot drop a date, and an undated one asks for one */
  urgent: boolean;
  /** Which edge the picker opens from; 'left' when the date sits at the start of a line */
  align?: 'left' | 'right';
}

const PICKS: { key: QuickDue; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'friday', label: 'Friday' },
  { key: 'nextWeek', label: 'Next week' },
];

/**
 * A part's due date that changes in place: press it, pick a new date
 *
 * Saves at once and writes the change to the job's history. An urgent part
 * with no date shows "Needs a date" so it is set before it can slip.
 */
const DueMenu = ({ partId, due, state, today, urgent, align = 'right' }: DueMenuProps) => {
  const { setPartDue } = useTaskMutations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const save = (value: string | null) => {
    setOpen(false);
    setPartDue.mutate({ partId, due: value });
  };

  const needsDate = urgent && !due;

  return (
    <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change the due date"
        className="rounded-full outline-offset-2 hover:ring-1 hover:ring-border-brand"
      >
        {needsDate ? (
          <span className="inline-flex items-center rounded-full border border-dashed border-border-danger px-2 py-0.5 text-[11px] font-medium text-text-danger">
            Needs a date
          </span>
        ) : due ? (
          <DueChip due={due} state={state} />
        ) : (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-text-muted opacity-0 transition group-hover:opacity-100">
            + Date
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-7 z-20 w-44 rounded-lg border border-border-muted bg-surface-primary p-1 shadow-lg`}>
          {PICKS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => save(quickDue(p.key, today))}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-text-primary hover:bg-fill-secondary"
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            aria-label="Pick a date"
            defaultValue={due ?? ''}
            onChange={(e) => e.target.value && save(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-border-muted bg-surface-primary px-2 text-sm text-text-primary"
          />
          {due && !urgent && (
            <button
              type="button"
              onClick={() => save(null)}
              className="mt-1 block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-text-muted hover:bg-fill-secondary"
            >
              Remove date
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DueMenu;

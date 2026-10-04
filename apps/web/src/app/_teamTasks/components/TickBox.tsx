'use client';

import { IconCheck } from '@tabler/icons-react';

interface TickBoxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

/**
 * The round tick used on every task row
 *
 * Ticking marks one part done; it never closes a job.
 */
const TickBox = ({ checked, onChange, disabled, label }: TickBoxProps) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all ${
      checked
        ? 'border-emerald-500 bg-emerald-500 text-white'
        : 'border-border-primary bg-surface-primary text-transparent hover:border-text-primary hover:text-text-muted'
    } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-primary disabled:hover:text-transparent`}
  >
    <IconCheck size={11} stroke={3} />
  </button>
);

export default TickBox;

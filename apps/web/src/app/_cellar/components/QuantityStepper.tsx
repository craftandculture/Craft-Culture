'use client';

import { IconMinus, IconPlus } from '@tabler/icons-react';

export interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Read out with the buttons, e.g. "bottle of Cervaro 2019" */
  label: string;
  /** Lowest value the minus button goes to */
  min?: number;
}

/**
 * Bottles to deliver, as one control: minus, the count of what is held, plus
 *
 * Built to be pressed. The two copies it replaced had 24px and 28px targets, a
 * browser spinner inside the number box and the total as a separate "/ 2", so
 * members missed the buttons and could not see at a glance how many they had
 * chosen. The count can still be typed for a large parcel.
 */
const QuantityStepper = ({
  value,
  max,
  onChange,
  label,
  min = 0,
}: QuantityStepperProps) => {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));

  return (
    <span className="border-border-muted bg-surface-primary inline-flex h-9 items-center rounded-full border shadow-sm">
      <button
        type="button"
        aria-label={`One fewer ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="text-text-primary hover:bg-fill-muted flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-30"
      >
        <IconMinus size={15} />
      </button>
      <span className="flex items-baseline gap-1 px-1">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          aria-label={`Number of ${label}`}
          onFocus={(event) => event.target.select()}
          onChange={(event) =>
            onChange(clamp(Number(event.target.value.replace(/\D/g, '')) || 0))
          }
          className="text-text-primary w-7 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        />
        <span className="text-text-muted whitespace-nowrap text-xs">
          of {max}
        </span>
      </span>
      <button
        type="button"
        aria-label={`One more ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="text-text-primary hover:bg-fill-muted flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-30"
      >
        <IconPlus size={15} />
      </button>
    </span>
  );
};

export default QuantityStepper;

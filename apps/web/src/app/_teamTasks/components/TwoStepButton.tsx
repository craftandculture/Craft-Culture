'use client';

import { useEffect, useState } from 'react';

interface TwoStepButtonProps {
  /** What the button says before it is armed, e.g. "Close job" */
  label: string;
  /** What it says once armed, e.g. "Yes, close it" */
  confirmLabel: string;
  onConfirm: () => void;
  tone?: 'brand' | 'danger' | 'neutral';
  disabled?: boolean;
  size?: 'sm' | 'xs';
}

const tones = {
  brand: 'border-text-primary bg-text-primary text-surface-primary',
  danger: 'border-border-danger bg-fill-danger text-text-danger-on-fill',
  neutral: 'border-border-primary bg-fill-primary text-text-primary',
};

/**
 * A button that needs two presses, so a job is never closed by accident
 *
 * The first press arms it; the second, within five seconds, acts. Left alone,
 * it disarms itself.
 */
const TwoStepButton = ({ label, confirmLabel, onConfirm, tone = 'brand', disabled, size = 'sm' }: TwoStepButtonProps) => {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  const sizing = size === 'xs' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm';

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (armed) {
            setArmed(false);
            onConfirm();
          } else {
            setArmed(true);
          }
        }}
        className={`${sizing} rounded-lg border font-medium transition disabled:opacity-50 ${
          armed ? tones[tone] : 'border-border-primary bg-fill-primary text-text-primary hover:bg-fill-primary-hover'
        }`}
      >
        {armed ? confirmLabel : label}
      </button>
      {armed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setArmed(false);
          }}
          className={`${sizing} rounded-lg text-text-muted hover:text-text-primary`}
        >
          Keep open
        </button>
      )}
    </span>
  );
};

export default TwoStepButton;

'use client';

import type { CellarCurrency } from '@/app/_cellar/constants/cellarCurrencies';

export interface CurrencyToggleProps {
  value: CellarCurrency;
  options: readonly CellarCurrency[];
  onChange: (currency: CellarCurrency) => void;
  className?: string;
}

/**
 * USD · EUR · GBP · AED, as one segmented control
 *
 * The same control wherever a member reads or sets a price, so the currency
 * on screen is never in doubt.
 */
const CurrencyToggle = ({
  value,
  options,
  onChange,
  className = '',
}: CurrencyToggleProps) => {
  return (
    <div
      role="group"
      aria-label="Currency"
      className={`border-border-muted bg-surface-primary inline-flex overflow-hidden rounded-lg border ${className}`}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`min-h-9 px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === option
              ? 'bg-text-primary text-surface-primary'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

export default CurrencyToggle;

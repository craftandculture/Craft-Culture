'use client';

import { IconInfoCircle } from '@tabler/icons-react';

import Input from '@/app/_ui/components/Input/Input';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface B2BCalculatorInputProps {
  /** Input label */
  label: string;
  /** Optional helper text below label */
  helperText?: string;
  /** Optional tooltip text */
  tooltipText?: string;
  /** Input value */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Suffix text (%, $, etc.) */
  suffix?: string;
  /** Prefix text ($, etc.) */
  prefix?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
}

/**
 * Number input field for B2B calculator
 *
 * @example
 *   <B2BCalculatorInput
 *     label="Transfer cost"
 *     value={200}
 *     onChange={setValue}
 *     prefix="$"
 *   />
 */
const B2BCalculatorInput = ({
  label,
  helperText,
  tooltipText,
  value,
  onChange,
  suffix,
  prefix,
  disabled = false,
  min = 0,
  max,
}: B2BCalculatorInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);

    // Validate the value
    if (isNaN(newValue)) {
      onChange(0);
      return;
    }

    // Apply min/max constraints
    let constrainedValue = newValue;
    if (min !== undefined && constrainedValue < min) {
      constrainedValue = min;
    }
    if (max !== undefined && constrainedValue > max) {
      constrainedValue = max;
    }

    onChange(constrainedValue);
  };

  return (
    <div className="flex flex-col space-y-1.5">
      <div className="flex flex-col space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Typography variant="bodySm">
            {label}
          </Typography>
          {tooltipText && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex">
                  <IconInfoCircle className="h-3.5 w-3.5 text-text-muted" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-w-xs p-3">
                <Typography variant="bodyXs">{tooltipText}</Typography>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {helperText && (
          <Typography variant="bodyXs" colorRole="muted">
            {helperText}
          </Typography>
        )}
      </div>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          step="any"
          size="md"
          contentLeft={
            prefix ? (
              <Typography
                variant="bodySm"
                colorRole="muted"
                className="ml-1 mr-0.5"
              >
                {prefix}
              </Typography>
            ) : undefined
          }
          contentRight={
            suffix ? (
              <Typography
                variant="bodySm"
                colorRole="muted"
                className="mr-2 ml-0.5"
              >
                {suffix}
              </Typography>
            ) : undefined
          }
          className="tabular-nums"
        />
      </div>
    </div>
  );
};

export default B2BCalculatorInput;

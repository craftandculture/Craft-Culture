'use client';

import { IconBarcode, IconLoader2 } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ScanInputProps {
  /** Callback when a barcode is scanned (Enter key pressed) */
  onScan: (barcode: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is loading/processing */
  isLoading?: boolean;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Error message to display */
  error?: string;
  /** Success message to display */
  success?: string;
  /** Label for the input */
  label?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * ScanInput - a large, mobile-friendly input for barcode scanning
 *
 * Designed for use with keyboard-wedge barcode scanners on Zebra TC21/TC26 devices.
 * The scanner acts as a keyboard and sends characters followed by Enter.
 *
 * @example
 *   <ScanInput
 *     label="Scan case barcode"
 *     placeholder="CASE-..."
 *     onScan={(barcode) => handleScan(barcode)}
 *   />
 */
const ScanInput = ({
  onScan,
  placeholder = 'Scan barcode...',
  isLoading = false,
  autoFocus = true,
  error,
  success,
  label,
  disabled = false,
}: ScanInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Re-focus after loading completes
  useEffect(() => {
    if (!isLoading && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [isLoading, disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      onScan(value.trim());
      setValue('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  return (
    <div className="w-full">
      {label && (
        <Typography variant="bodySm" className="mb-2 font-medium">
          {label}
        </Typography>
      )}

      <div
        className={`relative rounded-xl border-2 transition-colors ${
          error
            ? 'border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
            : success
              ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
              : 'border-border-primary bg-fill-primary focus-within:border-border-brand'
        }`}
      >
        <div className="flex items-center px-4">
          <Icon
            icon={isLoading ? IconLoader2 : IconBarcode}
            size="lg"
            className={isLoading ? 'animate-spin text-text-muted' : 'text-text-muted'}
          />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-h-[56px] w-full bg-transparent px-3 text-lg font-medium text-text-primary placeholder:text-text-muted/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <Typography variant="bodyXs" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </Typography>
      )}

      {success && (
        <Typography variant="bodyXs" className="mt-2 text-emerald-600 dark:text-emerald-400">
          {success}
        </Typography>
      )}

      <Typography variant="bodyXs" colorRole="muted" className="mt-2">
        Or type barcode manually and press Enter
      </Typography>
    </div>
  );
};

export default ScanInput;

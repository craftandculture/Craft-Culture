'use client';

import { IconArrowRight, IconBarcode, IconLoader2 } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  /** Whether to show virtual keyboard (default: false for scanner use) */
  showKeyboard?: boolean;
}

/**
 * ScanInput - a large, mobile-friendly input for barcode scanning
 *
 * Designed for use with keyboard-wedge barcode scanners on Zebra TC21/TC26/TC27 devices.
 * The scanner acts as a keyboard and sends characters followed by Enter.
 *
 * By default, prevents the virtual keyboard from appearing (inputMode="none")
 * since the scanner sends keystrokes directly. Use showKeyboard=true if manual
 * entry is needed.
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
  showKeyboard = false,
}: ScanInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastScannedValueRef = useRef('');

  // Debounce time in ms - prevents double scans (increased for scanner reliability)
  const SCAN_DEBOUNCE_MS = 1000;

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Re-focus after loading completes and clear any pending input
  useEffect(() => {
    if (!isLoading && inputRef.current && !disabled) {
      processingRef.current = false;
      setValue('');
      inputRef.current.focus();
    }
  }, [isLoading, disabled]);

  // Clear value when loading starts
  useEffect(() => {
    if (isLoading) {
      processingRef.current = true;
    }
  }, [isLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();

        const scannedValue = value.trim();
        const now = Date.now();

        // Debounce rapid scans
        if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
          setValue('');
          return;
        }

        // Prevent scanning the exact same value twice in a row within 3 seconds
        if (scannedValue === lastScannedValueRef.current && now - lastScanTimeRef.current < 3000) {
          setValue('');
          return;
        }

        // Prevent double-processing
        if (processingRef.current || isLoading) {
          setValue('');
          return;
        }

        lastScanTimeRef.current = now;
        lastScannedValueRef.current = scannedValue;
        processingRef.current = true;
        setValue('');
        onScan(scannedValue);
      }
    },
    [value, onScan, isLoading],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Ignore input while processing to prevent double-scan accumulation
      if (processingRef.current || isLoading) {
        return;
      }
      setValue(e.target.value);
    },
    [isLoading],
  );

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;

    const scannedValue = value.trim();
    const now = Date.now();

    // Debounce rapid submissions
    if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
      setValue('');
      return;
    }

    // Prevent scanning the exact same value twice in a row within 3 seconds
    if (scannedValue === lastScannedValueRef.current && now - lastScanTimeRef.current < 3000) {
      setValue('');
      return;
    }

    // Prevent double-processing
    if (processingRef.current || isLoading) {
      setValue('');
      return;
    }

    lastScanTimeRef.current = now;
    lastScannedValueRef.current = scannedValue;
    processingRef.current = true;
    setValue('');
    onScan(scannedValue);
  }, [value, onScan, isLoading]);

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
            inputMode={showKeyboard ? 'text' : 'none'}
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
          {value.trim() && !isLoading && (
            <button
              type="button"
              onClick={handleSubmit}
              className="ml-2 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              aria-label="Submit barcode"
            >
              <IconArrowRight className="h-6 w-6" />
            </button>
          )}
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

      {showKeyboard && (
        <Typography variant="bodyXs" colorRole="muted" className="mt-2">
          Or type barcode manually and press Enter
        </Typography>
      )}
    </div>
  );
};

export default ScanInput;

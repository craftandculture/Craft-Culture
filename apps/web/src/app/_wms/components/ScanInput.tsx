'use client';

import { IconArrowRight, IconBarcode, IconKeyboard, IconLoader2 } from '@tabler/icons-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

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
  /** Whether to enable haptic/sound feedback (default: true) */
  enableFeedback?: boolean;
}

// Audio context for feedback sounds
let audioContext: AudioContext | null = null;

/**
 * Play a success beep sound using Web Audio API
 */
const playSuccessBeep = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch {
    // Ignore audio errors (e.g., autoplay policy)
  }
};

/**
 * Play an error buzz sound
 */
const playErrorBuzz = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 200; // Low buzz
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    // Ignore audio errors
  }
};

/**
 * Trigger haptic vibration (if available)
 */
const triggerVibration = (pattern: number | number[]) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export interface ScanInputHandle {
  focus: () => void;
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
 *     ref={scanInputRef}
 *     label="Scan case barcode"
 *     placeholder="CASE-..."
 *     onScan={(barcode) => handleScan(barcode)}
 *   />
 */
const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(({
  onScan,
  placeholder = 'Scan barcode...',
  isLoading = false,
  autoFocus = true,
  error,
  success,
  label,
  disabled = false,
  showKeyboard = false,
  enableFeedback = true,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Internal keyboard toggle state - allows user to enable keyboard for manual input
  const [keyboardEnabled, setKeyboardEnabled] = useState(showKeyboard);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));
  const [value, setValue] = useState('');
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastScannedValueRef = useRef('');

  // Debounce time in ms - prevents double scans
  const SCAN_DEBOUNCE_MS = 1500;
  // Cooldown after successful scan - ignore all input during this period
  const SCAN_COOLDOWN_MS = 2000;

  // Auto-focus on mount only (not on re-renders)
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      // Small delay to prevent keyboard popup on mobile during page transitions
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // Only run on mount

  // Reset processing state when loading completes, but DON'T auto-focus
  // User can tap input to focus if they need to scan again
  useEffect(() => {
    if (!isLoading) {
      // Keep processing blocked for cooldown period after scan completes
      setTimeout(() => {
        processingRef.current = false;
      }, SCAN_COOLDOWN_MS);
      setValue('');
    }
  }, [isLoading]);

  // Block input while loading
  useEffect(() => {
    if (isLoading) {
      processingRef.current = true;
    }
  }, [isLoading]);

  // Reset processing state when error occurs (so user can retry)
  // Also provide error feedback
  useEffect(() => {
    if (error) {
      processingRef.current = false;
      // Provide error feedback
      if (enableFeedback) {
        playErrorBuzz();
        triggerVibration([100, 50, 100]); // Double buzz for error
      }
    }
  }, [error, enableFeedback]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();

        const scannedValue = value.trim();
        const now = Date.now();

        // Debounce rapid scans (but allow after 1.5 seconds)
        if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
          setValue('');
          return;
        }

        // Prevent scanning the exact same value twice in a row within 3 seconds
        if (scannedValue === lastScannedValueRef.current && now - lastScanTimeRef.current < 3000) {
          setValue('');
          return;
        }

        // If currently loading, don't allow new submissions
        if (isLoading) {
          setValue('');
          return;
        }

        // Safety reset: if processingRef has been stuck for more than 5 seconds, reset it
        if (processingRef.current && now - lastScanTimeRef.current > 5000) {
          processingRef.current = false;
        }

        // Prevent double-processing (but with safety reset above)
        if (processingRef.current) {
          setValue('');
          return;
        }

        lastScanTimeRef.current = now;
        lastScannedValueRef.current = scannedValue;
        processingRef.current = true;
        setValue('');

        // Provide haptic/audio feedback on scan
        if (enableFeedback) {
          playSuccessBeep();
          triggerVibration(100);
        }

        onScan(scannedValue);
      }
    },
    [value, onScan, isLoading, enableFeedback],
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

    // Debounce rapid submissions (but allow after 1.5 seconds)
    if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
      setValue('');
      return;
    }

    // Prevent scanning the exact same value twice in a row within 3 seconds
    if (scannedValue === lastScannedValueRef.current && now - lastScanTimeRef.current < 3000) {
      setValue('');
      return;
    }

    // If currently loading, don't allow new submissions
    if (isLoading) {
      setValue('');
      return;
    }

    // Safety reset: if processingRef has been stuck for more than 5 seconds, reset it
    if (processingRef.current && now - lastScanTimeRef.current > 5000) {
      processingRef.current = false;
    }

    // Prevent double-processing (but with safety reset above)
    if (processingRef.current) {
      setValue('');
      return;
    }

    lastScanTimeRef.current = now;
    lastScannedValueRef.current = scannedValue;
    processingRef.current = true;
    setValue('');

    // Provide haptic/audio feedback on scan
    if (enableFeedback) {
      playSuccessBeep();
      triggerVibration(100);
    }

    onScan(scannedValue);
  }, [value, onScan, isLoading, enableFeedback]);

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
            inputMode={keyboardEnabled ? 'text' : 'none'}
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
          {/* Keyboard toggle button - allows manual input when needed */}
          {!value.trim() && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setKeyboardEnabled(!keyboardEnabled);
                // Re-focus to trigger keyboard
                setTimeout(() => {
                  inputRef.current?.blur();
                  inputRef.current?.focus();
                }, 50);
              }}
              className={`ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
                keyboardEnabled
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                  : 'border-border-primary bg-fill-secondary text-text-muted hover:bg-fill-tertiary'
              }`}
              aria-label={keyboardEnabled ? 'Disable keyboard' : 'Enable keyboard for manual input'}
              title={keyboardEnabled ? 'Keyboard enabled - tap to disable' : 'Tap for manual input'}
            >
              <IconKeyboard className="h-5 w-5" />
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

      {keyboardEnabled && (
        <Typography variant="bodyXs" colorRole="muted" className="mt-2">
          Keyboard enabled - type barcode and press Enter
        </Typography>
      )}
    </div>
  );
});

ScanInput.displayName = 'ScanInput';

export default ScanInput;

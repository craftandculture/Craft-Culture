'use client';

export interface InlineConfirmProps {
  /** What is about to happen, phrased as a question */
  message: string;
  confirmLabel?: string;
  /** Whether the confirmed action is destructive, which colours the button red */
  danger?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * An in-page "Are you sure?" with Confirm and Cancel
 *
 * Used instead of the browser's confirm(), which Chrome can suppress for the
 * page after a few dialogs, at which point it returns false and the action
 * silently does nothing.
 *
 * @example
 *   <InlineConfirm
 *     message="Remove this line?"
 *     danger
 *     onConfirm={() => removeItem({ itemId })}
 *     onCancel={() => setPending(null)}
 *   />
 */
const InlineConfirm = ({
  message,
  confirmLabel = 'Confirm',
  danger = false,
  isPending = false,
  onConfirm,
  onCancel,
}: InlineConfirmProps) => {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-primary">{message}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        className={`inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
          danger ? 'bg-red-600 text-white' : 'bg-text-primary text-surface-primary'
        }`}
      >
        {isPending ? 'Working…' : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="inline-flex h-7 items-center rounded-lg border border-border-primary px-2.5 text-xs font-medium text-text-primary hover:bg-fill-muted disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
};

export default InlineConfirm;

import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

export interface CellarStateProps {
  /** Which state to show */
  kind: 'loading' | 'error' | 'empty';
  /** Optional icon above an empty message */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** The empty state's first line */
  title?: React.ReactNode;
  /** The empty state's supporting line; also overrides the error message */
  message?: React.ReactNode;
  /** An optional button or link under an empty state */
  action?: React.ReactNode;
  /** Number of placeholder rows while loading */
  rows?: number;
  className?: string;
}

const ERROR_MESSAGE =
  'We cannot show this just now. Please try again shortly, or contact the cellar team.';

/**
 * Loading, error and empty states for every cellar tab
 *
 * A skeleton rather than a "Loading..." line, one calm sentence when a query
 * fails, and an empty state that says what will appear and how to begin.
 */
const CellarState = ({
  kind,
  icon: StateIcon,
  title,
  message,
  action,
  rows = 3,
  className = '',
}: CellarStateProps) => {
  if (kind === 'loading') {
    return (
      <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (kind === 'error') {
    return (
      <div
        role="alert"
        className={`border-border-muted bg-surface-primary text-text-muted rounded-xl border px-4 py-5 text-sm leading-6 shadow-sm ${className}`}
      >
        {message ?? ERROR_MESSAGE}
      </div>
    );
  }

  return (
    <div
      className={`border-border-muted bg-surface-primary flex flex-col items-center gap-2 rounded-xl border px-6 py-12 text-center shadow-sm ${className}`}
    >
      {StateIcon && (
        <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.08]">
          <StateIcon size={24} className="text-text-muted" />
        </span>
      )}
      {title && <p className="text-text-primary text-sm font-semibold">{title}</p>}
      {message && <p className="text-text-muted max-w-sm text-sm leading-6">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export default CellarState;

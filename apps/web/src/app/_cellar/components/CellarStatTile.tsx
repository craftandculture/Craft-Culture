export interface CellarStatTileProps {
  /** What the number counts, e.g. "Bottles offered" */
  label: React.ReactNode;
  /** The figure itself */
  value: React.ReactNode;
  /** A short muted line that puts the figure in context */
  detail?: React.ReactNode;
  /** Emerald for money coming to the member or something complete */
  tone?: 'plain' | 'emerald';
  /** Makes the tile a button, for tiles that double as filters */
  onClick?: () => void;
  /** Whether a filter tile is currently applied */
  isActive?: boolean;
  className?: string;
}

const TONES = {
  plain: 'border-border-muted bg-surface-primary',
  emerald:
    'border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-surface-primary dark:border-emerald-900 dark:from-emerald-500/10 dark:to-surface-primary',
};

/**
 * One figure about a member's cellar, in a white card
 *
 * The same tile on every cellar tab: a small label, a large number and a
 * muted line beneath. Passing onClick turns it into a filter button.
 */
const CellarStatTile = ({
  label,
  value,
  detail,
  tone = 'plain',
  onClick,
  isActive = false,
  className = '',
}: CellarStatTileProps) => {
  const classes = `rounded-xl border px-3 py-2.5 text-left shadow-sm sm:px-4 sm:py-3 ${TONES[tone]} ${
    isActive ? 'ring-text-primary ring-2' : ''
  } ${className}`;

  const body = (
    <>
      <span className="text-text-muted block text-[10px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-text-primary mt-1 block text-lg font-semibold tabular-nums sm:text-xl">
        {value}
      </span>
      {detail && (
        <span className="text-text-muted block text-[11px] leading-4">{detail}</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={`${classes} transition-shadow hover:shadow-md`}
      >
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
};

export default CellarStatTile;

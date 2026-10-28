import type { Icon as TablerIcon } from '@tabler/icons-react';

export interface CellarStatTileProps {
  /** What the number counts, e.g. "Bottles offered" */
  label: React.ReactNode;
  /** The figure itself */
  value: React.ReactNode;
  /** A short muted line that puts the figure in context */
  detail?: React.ReactNode;
  /** The tile's tint, as on Stock Explorer; emerald is kept for money owed to the member */
  tone?: 'plain' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'violet';
  /** A small icon above the figure */
  icon?: TablerIcon;
  /** Makes the tile a button, for tiles that double as filters */
  onClick?: () => void;
  /** Whether a filter tile is currently applied */
  isActive?: boolean;
  className?: string;
}

const TONES = {
  plain: {
    tile: 'border-border-muted from-surface-muted/60 dark:from-surface-muted/30',
    chip: 'bg-surface-muted text-text-muted',
    value: 'text-text-primary',
  },
  blue: {
    tile: 'border-blue-100 from-blue-50/40 dark:border-blue-900/40 dark:from-blue-950/30',
    chip: 'bg-blue-100/70 text-blue-500 dark:bg-blue-900/40 dark:text-blue-300',
    value: 'text-text-primary',
  },
  indigo: {
    tile: 'border-indigo-100 from-indigo-50/40 dark:border-indigo-900/40 dark:from-indigo-950/30',
    chip: 'bg-indigo-100/70 text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300',
    value: 'text-text-primary',
  },
  emerald: {
    tile: 'border-emerald-100 from-emerald-50/40 dark:border-emerald-900/40 dark:from-emerald-950/30',
    chip: 'bg-emerald-100/70 text-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    tile: 'border-amber-100 from-amber-50/40 dark:border-amber-900/40 dark:from-amber-950/30',
    chip: 'bg-amber-100/70 text-amber-500 dark:bg-amber-900/40 dark:text-amber-300',
    value: 'text-text-primary',
  },
  violet: {
    tile: 'border-violet-100 from-violet-50/40 dark:border-violet-900/40 dark:from-violet-950/30',
    chip: 'bg-violet-100/70 text-violet-500 dark:bg-violet-900/40 dark:text-violet-300',
    value: 'text-text-primary',
  },
};

/**
 * One figure about a member's cellar, as a Stock Explorer KPI tile
 *
 * A tinted card with an icon chip, the figure and a small label beneath, so
 * the cellar reads as part of the same platform as the rest of Index.
 * Passing onClick turns it into a filter button.
 */
const CellarStatTile = ({
  label,
  value,
  detail,
  tone = 'plain',
  icon: TileIcon,
  onClick,
  isActive = false,
  className = '',
}: CellarStatTileProps) => {
  const colours = TONES[tone];
  const classes = `bg-surface-primary to-surface-primary rounded-xl border bg-gradient-to-b px-3 py-3 text-center shadow-sm ${colours.tile} ${
    isActive ? 'ring-text-primary ring-2' : ''
  } ${className}`;

  const body = (
    <>
      {TileIcon && (
        <span
          className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg ${colours.chip}`}
        >
          <TileIcon size={14} />
        </span>
      )}
      <span
        className={`block text-lg font-bold leading-tight tabular-nums ${colours.value}`}
      >
        {value}
      </span>
      <span className="text-text-muted block text-[11px]">{label}</span>
      {detail && (
        <span className="text-text-muted block text-[10px] leading-4">
          {detail}
        </span>
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

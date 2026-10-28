import type { Icon as TablerIcon } from '@tabler/icons-react';

export interface CellarStatTileProps {
  /** What the number counts, e.g. "Bottles offered" */
  label: React.ReactNode;
  /** The figure itself */
  value: React.ReactNode;
  /** A short muted line that puts the figure in context */
  detail?: React.ReactNode;
  /** The tile's tint: neutral, or emerald for money owed to the member; the other names read as neutral */
  tone?: 'plain' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'violet';
  /** A small icon above the figure */
  icon?: TablerIcon;
  /** Makes the tile a button, for tiles that double as filters */
  onClick?: () => void;
  /** Whether a filter tile is currently applied */
  isActive?: boolean;
  className?: string;
}

const PLAIN = {
  tile: 'border-border-muted from-surface-muted/60 dark:from-surface-muted/30',
  chip: 'bg-surface-muted text-text-muted',
  value: 'text-text-primary',
};

/*
  The cellar keeps to two tones: neutral, and C&C green for money owed to the
  member. The other names are kept so existing tiles still compile, but they
  all read as neutral, so no screen picks up blue, indigo or violet.
*/
const TONES = {
  plain: PLAIN,
  blue: PLAIN,
  indigo: PLAIN,
  emerald: {
    tile: 'border-emerald-100 from-emerald-50/40 dark:border-emerald-900/40 dark:from-emerald-950/30',
    chip: 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    value: 'text-emerald-700 dark:text-emerald-400',
  },
  amber: PLAIN,
  violet: PLAIN,
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
  const classes = `bg-surface-quiet to-surface-quiet rounded-xl border bg-gradient-to-b px-3 py-3 text-center ${colours.tile} ${
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

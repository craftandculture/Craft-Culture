import type { WineColour } from '../utils/wineColour';
import { WINE_COLOUR_LABELS } from '../utils/wineColour';

/** The dot for each colour: a glass of it, not a status */
const DOT: Record<WineColour, string> = {
  red: 'bg-[#8e1b2e]',
  white: 'bg-[#e6d27a]',
  rose: 'bg-[#e9a0a8]',
  sparkling: 'bg-[#c9b458] ring-1 ring-inset ring-white/60',
  fortified: 'bg-[#5b2a1a]',
  orange: 'bg-[#d9822b]',
  spirit: 'bg-[#a8763e]',
};

export interface WineColourBadgeProps {
  colour?: WineColour | null;
  className?: string;
}

/**
 * The wine's colour beside its name (a dot and the word), so "red or white?"
 * is answered from the screen rather than from the bottle
 *
 * Renders nothing when the colour is not known; the wines without one are
 * listed for staff to fill rather than flagged on every row.
 *
 * @example
 *   <WineColourBadge colour="red" />; // ● Red
 */
const WineColourBadge = ({ colour, className }: WineColourBadgeProps) => {
  if (!colour) return null;

  return (
    <span
      title={`Colour: ${WINE_COLOUR_LABELS[colour]}`}
      className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-muted ${className ?? ''}`}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[colour]}`} />
      {WINE_COLOUR_LABELS[colour]}
    </span>
  );
};

export default WineColourBadge;

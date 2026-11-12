/** The colours a wine is sold as: what a client asks when they ask "red or white?" */
export const WINE_COLOURS = ['red', 'white', 'rose', 'sparkling', 'fortified', 'orange', 'spirit'] as const;

export type WineColour = (typeof WINE_COLOURS)[number];

export const WINE_COLOUR_LABELS: Record<WineColour, string> = {
  red: 'Red',
  white: 'White',
  rose: 'Rosé',
  sparkling: 'Sparkling',
  fortified: 'Fortified',
  orange: 'Orange',
  /** For a spirit filed among the wines, such as a cask bottling */
  spirit: 'Spirit',
};

const FORTIFIED_SUB_TYPES = /port|sherry|madeira|marsala|fortified|vin doux|banyuls|rivesaltes|maury/i;

/**
 * A wine's colour from its Liv-ex record
 *
 * Sparkling and fortified win over the colour, because that is how the wine is
 * asked for: a rosé Champagne is sold as sparkling, a vintage port as
 * fortified (Liv-ex leaves port without a colour at all). Liv-ex's "amber" is
 * what the trade calls orange. A "mixed" case has no one colour, so it is
 * left for staff to set.
 *
 * @example
 *   colourFromLivex({ colour: 'rose', type: 'wine', subType: 'Sparkling' }); // 'sparkling'
 *   colourFromLivex({ colour: null, type: 'other', subType: 'Port' }); // 'fortified'
 */
const colourFromLivex = ({
  colour,
  type,
  subType,
}: {
  colour: string | null;
  type: string | null;
  subType: string | null;
}): WineColour | null => {
  if (subType && /sparkl/i.test(subType)) return 'sparkling';
  if (type === 'fortified' || (subType && FORTIFIED_SUB_TYPES.test(subType))) return 'fortified';

  switch (colour) {
    case 'red':
    case 'white':
    case 'rose':
    case 'orange':
      return colour;
    case 'amber':
      return 'orange';
    default:
      return null;
  }
};

export default colourFromLivex;

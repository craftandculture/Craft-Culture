/** Under this many days of stock left is "low" */
export const LOW_COVER_DAYS = 14;

/** A suggested order brings them back up to this many days */
export const TARGET_COVER_DAYS = 30;

/** A full case is suggested only when it sells within this many days */
const CASE_WITHIN_DAYS = 60;

export interface ReorderInput {
  /** Bottles on their shelf */
  held: number;
  /** Bottles already on their way to them */
  inTransit: number;
  /** Bottles they sold in the last 30 days, from their own feed */
  sold30: number;
  /** Bottles they sold in the last 90 days */
  sold90: number;
  /** Bottles per case we would ship it in; 1 for singles */
  pack: number;
}

/**
 * Whether a wine at the distributor needs reordering, and how much
 *
 * Measured in days of cover, not a fixed count: what they hold plus what is
 * already coming, over what they sell a day (their 30-day figure).
 *
 * - `oos`: an empty shelf of a wine that sold in the last 30 days.
 * - `low`: bottles still on the shelf, under 14 days of cover.
 * - `oneoff`: an empty shelf of a wine that sold in the last 90 days but not
 *   this month — a library bottle or one-off parcel. Not a reorder; listed
 *   for sourcing if anyone wants it again. An empty shelf is never "low".
 *
 * The suggestion tops cover up to 30 days. It is in whole cases only when a
 * case sells within two months; otherwise in bottles, because "1 case" of a
 * wine that sells one bottle a month is six bottles too many.
 *
 * @example
 *   assessReorder({ held: 2, inTransit: 0, sold30: 12, sold90: 30, pack: 6 });
 *   // { status: 'low', daysCover: 5, unit: 'case', suggestCases: 2, suggestBottles: 12 }
 *
 * @param input - Their position and sales for one wine
 * @returns status null when no action is needed
 */
const assessReorder = ({ held, inTransit, sold30, sold90, pack }: ReorderInput) => {
  const perDay = Math.max(0, sold30) / 30;
  const cover = held + inTransit;
  const daysCover = perDay > 0 ? Math.floor(cover / perDay) : null;
  const casePack = pack > 0 ? pack : 1;

  const status =
    held <= 0
      ? sold30 >= 1
        ? ('oos' as const)
        : sold90 >= 1
          ? ('oneoff' as const)
          : null
      : daysCover !== null && daysCover < LOW_COVER_DAYS
        ? ('low' as const)
        : null;

  if (!status || status === 'oneoff') {
    return { status, daysCover, perDay, unit: 'bottle' as const, suggestBottles: 0, suggestCases: 0 };
  }

  const shortfall = Math.max(1, Math.ceil(perDay * TARGET_COVER_DAYS - cover));
  const caseSellsInTime = casePack > 1 && casePack <= perDay * CASE_WITHIN_DAYS;

  if (caseSellsInTime) {
    const suggestCases = Math.ceil(shortfall / casePack);
    return {
      status,
      daysCover,
      perDay,
      unit: 'case' as const,
      suggestCases,
      suggestBottles: suggestCases * casePack,
    };
  }

  return { status, daysCover, perDay, unit: 'bottle' as const, suggestBottles: shortfall, suggestCases: 0 };
};

export default assessReorder;

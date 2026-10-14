/** Under this many days of stock left is "low" */
export const LOW_COVER_DAYS = 14;

/** A suggested order brings them back up to this many days */
export const TARGET_COVER_DAYS = 30;

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
 * already coming, over what they sell a day (their 30-day figure). A fast
 * seller is flagged with stock still on the shelf; a slow one is not nagged
 * about for holding two bottles.
 *
 * Out of stock means nothing on the shelf of a wine that sold in the last 90
 * days — a wine nobody has bought in three months being empty is not news.
 * The suggestion tops cover back up to 30 days, in whole cases, never less
 * than one case.
 *
 * @example
 *   assessReorder({ held: 2, inTransit: 0, sold30: 12, sold90: 30, pack: 6 });
 *   // { status: 'low', daysCover: 5, perDay: 0.4, suggestBottles: 12, suggestCases: 2 }
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
    held <= 0 && sold90 > 0
      ? ('oos' as const)
      : daysCover !== null && daysCover < LOW_COVER_DAYS
        ? ('low' as const)
        : null;

  if (!status) {
    return { status, daysCover, perDay, suggestBottles: 0, suggestCases: 0 };
  }

  // A wine that only sold in the 90-day window still gets a case's worth
  const shortfall = Math.max(0, Math.ceil(perDay * TARGET_COVER_DAYS - cover));
  const suggestCases = Math.max(1, Math.ceil(shortfall / casePack));

  return {
    status,
    daysCover,
    perDay,
    suggestBottles: suggestCases * casePack,
    suggestCases,
  };
};

export default assessReorder;

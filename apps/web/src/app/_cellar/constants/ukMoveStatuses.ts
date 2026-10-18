/**
 * Moves that still hold their LCB lines
 *
 * A line in any of these cannot be asked for again. "shipping" stays here
 * after the wine lands, because LCB's report keeps listing a line until the
 * next import after it leaves Burton.
 */
export const OPEN_UK_MOVE_STATUSES = ['submitted', 'quoted', 'accepted', 'shipping'];

/** Statuses a member may still withdraw from */
export const WITHDRAWABLE_UK_MOVE_STATUSES = ['submitted', 'quoted'];

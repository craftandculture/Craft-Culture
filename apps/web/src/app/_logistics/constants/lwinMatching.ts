/*
  Thresholds for matching an inbound line to an LWIN, shared by the matcher
  and by the test that measures it, so both judge a line the same way.
*/

/** Below this the runner-up is close enough that picking one is a guess. */
export const MIN_MARGIN = 0.12;

/** Below this nothing in 208k records resembled the line. */
export const MIN_SCORE = 0.45;

/**
 * Share of the register's name for Wine Labs' answer that the invoice line
 * must carry before that answer is written on its own. Wine Labs' name search
 * is the better reader of a messy supplier line, but in the October 2026 audit
 * it also returned a sibling cuvee (Penfolds Bin 23A for Bin 18A, a village
 * Gevrey for a premier cru), so its answer must read as the line first.
 */
export const WINELABS_FIT = 0.75;

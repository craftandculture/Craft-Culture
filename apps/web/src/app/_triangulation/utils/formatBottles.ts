/**
 * Format a bottle figure for the reconciliation tables
 *
 * Everything triangulates in bottles, so figures are whole numbers in almost
 * every case; a fraction only appears when a source file stated a partial
 * case, and that is worth seeing rather than rounding away.
 *
 * @example
 *   formatBottles(1234); // returns '1,234'
 *
 * @param value - The bottle count, or null when no data exists
 * @param options - Set `dash` to render null as an em dash instead of empty
 * @returns The formatted figure
 */
const formatBottles = (
  value: number | null | undefined,
  options?: { dash?: boolean },
) => {
  if (value === null || value === undefined) {
    return options?.dash === false ? '' : '—';
  }

  const rounded = Math.round(value * 100) / 100;

  return rounded.toLocaleString('en-GB', { maximumFractionDigits: 2 });
};

export default formatBottles;

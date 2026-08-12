'use client';

import formatBottles from '../utils/formatBottles';

export interface ValueCellProps {
  value: number | null;
  /** Difference from the calculated position, shown under the value */
  variance?: number | null;
  className?: string;
}

/**
 * A bottle figure, with its variance beneath rather than in brackets
 *
 * At eight numeric columns a bracketed delta competes with the value it
 * qualifies, and the eye can't run down a column cleanly. Stacking puts the
 * position on one line and the gap on another, so a column scans as a column.
 *
 * Zeros are muted: a reconciliation table is mostly zeros, and rendering them
 * at full weight buries the figures that carry information.
 */
const ValueCell = ({ value, variance, className }: ValueCellProps) => {
  const isEmpty = value === null || value === undefined;
  const isZero = value === 0;

  return (
    <td
      className={`py-2 pr-3 text-right align-middle tabular-nums ${className ?? ''}`}
    >
      <span
        className={isEmpty || isZero ? 'text-text-muted/60' : 'text-text-primary'}
      >
        {formatBottles(value)}
      </span>
      {variance !== null && variance !== undefined && variance !== 0 ? (
        <span
          className={`block text-xs ${
            variance < 0 ? 'text-text-danger' : 'text-text-warning'
          }`}
        >
          {variance > 0 ? '+' : ''}
          {formatBottles(variance)}
        </span>
      ) : null}
    </td>
  );
};

export default ValueCell;

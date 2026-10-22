export interface DescribeRevenuePaceInput {
  now: Date;
  revenueThisMonth: number;
  /** Last month from the 1st up to the same day of the month as `now` */
  revenueLastMonthToDate: number;
  revenueLastMonth: number;
  /** Best complete month before this one, or null when there is none */
  bestMonthUsd: number | null;
}

/**
 * Describe how this month's revenue is pacing, comparing like with like
 *
 * Month-to-date is set against the same point of last month, never against last
 * month's full total: on the 22nd a partial month will always look "down" on a
 * whole one, which is how the brief came to call a near-record month
 * concerning.
 *
 * @example
 *   describeRevenuePace({
 *     now: new Date(2026, 9, 22),
 *     revenueThisMonth: 205_000,
 *     revenueLastMonthToDate: 160_000,
 *     revenueLastMonth: 223_500,
 *     bestMonthUsd: 223_500,
 *   }).headline; // '+28% vs same point last month'
 *
 * @param input - Month-to-date, same-point and full-month revenue
 * @returns A short headline, a detail line and the figures behind them
 */
const describeRevenuePace = ({
  now,
  revenueThisMonth,
  revenueLastMonthToDate,
  revenueLastMonth,
  bestMonthUsd,
}: DescribeRevenuePaceInput) => {
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = daysInMonth - now.getDate();

  const vsSamePointPct =
    revenueLastMonthToDate > 0
      ? ((revenueThisMonth - revenueLastMonthToDate) / revenueLastMonthToDate) *
        100
      : null;

  const shareOfLastMonthPct =
    revenueLastMonth > 0 ? (revenueThisMonth / revenueLastMonth) * 100 : null;

  const isRecord = bestMonthUsd !== null && revenueThisMonth > bestMonthUsd;

  let headline: string;
  if (isRecord) {
    headline = 'Record month';
  } else if (vsSamePointPct !== null) {
    const rounded = Math.round(vsSamePointPct);
    headline = `${rounded >= 0 ? '+' : ''}${rounded}% vs same point last month`;
  } else {
    headline = 'No comparable month yet';
  }

  const daysLeftText =
    daysLeft === 0
      ? 'last day of the month'
      : `${daysLeft} day${daysLeft === 1 ? '' : 's'} to go`;

  const detail =
    shareOfLastMonthPct !== null
      ? `${Math.round(shareOfLastMonthPct)}% of last month's total, ${daysLeftText}`
      : daysLeftText;

  return {
    headline,
    detail,
    vsSamePointPct,
    shareOfLastMonthPct,
    isRecord,
    daysLeft,
  };
};

export default describeRevenuePace;

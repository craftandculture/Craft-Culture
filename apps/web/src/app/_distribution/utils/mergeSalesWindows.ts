import type { DailySalesDay } from './buildDailySales';

/** A window shorter than this did not cover the day on its own */
const FULL_DAY_HOURS = 18;

const sumBy = <T extends { productName: string; bottles: number }>(items: T[]) => {
  const out = new Map<string, T>();
  for (const item of items) {
    const seen = out.get(item.productName);
    out.set(item.productName, seen ? { ...seen, bottles: seen.bottles + item.bottles } : { ...item });
  }
  return [...out.values()];
};

/**
 * The windows since the last morning report, as one day
 *
 * Every pull writes a stock position, so a count taken by hand during the day
 * ("Pull latest count") splits that day in two. The morning report used to
 * post only the newest window: on 17 Nov it said 2 bottles for Monday 16
 * November, the six hours after a 20:43 pull, while the 132 bottles sold
 * before it were never posted. Windows are taken newest first until they
 * cover a day, then added together.
 *
 * @param days - Daily windows, newest first, from `getDailyOutletSales`
 * @returns One day covering them, or undefined if there are none
 */
const mergeSalesWindows = (days: DailySalesDay[]): DailySalesDay | undefined => {
  const taken: DailySalesDay[] = [];
  let hours = 0;
  for (const day of days) {
    if (taken.length > 0 && hours >= FULL_DAY_HOURS) break;
    taken.push(day);
    hours += day.spanHours;
  }

  const [newest] = taken;
  if (!newest || taken.length === 1) return newest;
  const oldest = taken[taken.length - 1] ?? newest;

  const lines = new Map<string, DailySalesDay['lines'][number]>();
  // Oldest first, so the newest window's count is the one held after
  for (const day of [...taken].reverse()) {
    for (const line of day.lines) {
      const seen = lines.get(line.outletCode);
      lines.set(
        line.outletCode,
        seen
          ? {
              ...line,
              sold: seen.sold + line.sold,
              value: seen.value === null && line.value === null ? null : (seen.value ?? 0) + (line.value ?? 0),
            }
          : { ...line },
      );
    }
  }

  const sinces = taken.map((d) => d.resumed.since).filter((s): s is string => s !== null).sort();

  return {
    salesDate: oldest.salesDate,
    openedAt: oldest.openedAt,
    closedAt: newest.closedAt,
    spanHours: hours,
    consigned: {
      bottles: taken.reduce((sum, d) => sum + d.consigned.bottles, 0),
      value: taken.reduce((sum, d) => sum + d.consigned.value, 0),
    },
    bought: {
      bottles: taken.reduce((sum, d) => sum + d.bought.bottles, 0),
      value: taken.reduce((sum, d) => sum + d.bought.value, 0),
    },
    lines: [...lines.values()].sort((a, b) => b.sold - a.sold || a.productName.localeCompare(b.productName)),
    restocks: sumBy(taken.flatMap((d) => d.restocks)),
    withdrawals: sumBy(taken.flatMap((d) => d.withdrawals)),
    dropped: sumBy(newest.dropped),
    resumed: {
      wines: taken.reduce((sum, d) => sum + d.resumed.wines, 0),
      sold: taken.reduce((sum, d) => sum + d.resumed.sold, 0),
      since: sinces[0] ?? null,
    },
    stock: newest.stock,
  };
};

export default mergeSalesWindows;

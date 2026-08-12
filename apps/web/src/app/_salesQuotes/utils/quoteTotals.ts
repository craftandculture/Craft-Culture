import type { SalesQuoteLine } from '@/database/schema';

import prepareQuoteLine from './prepareQuoteLine';

/**
 * Summarise a quote for the dashboard.
 *
 * `bottles` counts everything on offer, whereas `usd` values only the
 * pre-filled quantities — an open line with no quantity set contributes
 * availability but no value, matching what the quote page's own total shows.
 *
 * @param lines - The quote's lines
 * @param orderUnit - Whether the quote is ordered per bottle or per case
 * @returns Total bottles offered and the pre-filled value in USD
 */
const quoteTotals = (
  lines: SalesQuoteLine[],
  orderUnit: string = 'bottle',
) => {
  let bottles = 0;
  let usd = 0;

  for (const line of lines) {
    const prepared = prepareQuoteLine(line, orderUnit);
    if (prepared.oos) continue;
    bottles += prepared.avail;
    usd += prepared.qty * (Number(line.busd) || 0);
  }

  return { bottles, usd: Math.round(usd * 100) / 100 };
};

export default quoteTotals;

/**
 * Read a /price_stats response: the latest snapshot in `results`
 *
 * Prices are per bottle in the requested currency, aggregated from retail
 * offers in the requested region.
 *
 * @example
 *   parsePriceStatsResponse({ results: [{ date: '2026-10-20', median_value: 55, count: 36 }] });
 *   // { latest: {...}, medianUsd: 55, count: 36 }
 *
 * @param body - The parsed JSON body
 * @returns The latest snapshot, or null when Wine Labs has no recent prices
 */
const parsePriceStatsResponse = (body: unknown) => {
  if (!body || typeof body !== 'object') return null;
  const results = (body as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return null;

  const snapshots = results.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object',
  );
  const dateOf = (row: Record<string, unknown>) => String(row.date ?? row.created_at ?? '');
  const latest = [...snapshots].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))[0];
  if (!latest) return null;

  const median = Number(latest.median_value);
  const count = Number(latest.count);
  return {
    latest,
    medianUsd: Number.isFinite(median) && median > 0 ? median : null,
    count: Number.isFinite(count) ? Math.round(count) : null,
  };
};

export default parsePriceStatsResponse;

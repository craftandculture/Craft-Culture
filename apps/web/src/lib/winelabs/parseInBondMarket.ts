const rowsOf = (body: unknown) => {
  if (!body || typeof body !== 'object') return [];
  const results = (body as Record<string, unknown>).results;
  return Array.isArray(results)
    ? results.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    : [];
};

const priceOf = (row: Record<string, unknown>) => {
  const value = Number(row.adjusted_price);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Read an /exchange/orderbook and an /exchange/trades response into one
 * London in-bond price for one bottle size of one wine and vintage
 *
 * Only rows for the vintage and size asked about, in bond, count: the
 * exchanges list magnums and other vintages under the same wine. Prices are
 * Wine Labs' adjusted_price, per bottle in USD (trades are struck in GBP and
 * converted by Wine Labs).
 *
 * @example
 *   parseInBondMarket(
 *     { results: [{ vintage: '2010', format: '750', duty_code: 'IB', bid_ask: 'BID', adjusted_price: 356, source: 'bordeaux_index' }] },
 *     { results: [] },
 *     '2010',
 *   );
 *   // { bidUsd: 356, askUsd: null, lastUsd: null, ..., venues: ['bordeaux_index'] }
 *
 * @param orderbook - The orderbook response body
 * @param trades - The trades response body, or null when it was not asked for
 * @param vintage - The vintage asked about; LWIN's 1000 for non-vintage
 * @param format - The bottle size in ml, as the exchanges write it ('750', '1500')
 * @returns Best bid, best ask, last trade and the venues seen
 */
const parseInBondMarket = (orderbook: unknown, trades: unknown, vintage: string, format = '750') => {
  const ours = (row: Record<string, unknown>) =>
    String(row.vintage ?? '') === vintage &&
    Number(row.format ?? 750) === Number(format) &&
    String(row.duty_code ?? 'IB') === 'IB' &&
    priceOf(row) !== null;

  const orders = rowsOf(orderbook).filter(ours);
  const bids = orders.filter((row) => row.bid_ask === 'BID').map((row) => priceOf(row)!);
  const asks = orders.filter((row) => row.bid_ask === 'ASK').map((row) => priceOf(row)!);

  const deals = rowsOf(trades)
    .filter(ours)
    .sort((a, b) => String(b.traded_at ?? '').localeCompare(String(a.traded_at ?? '')));
  const last = deals[0];
  // Wine Labs sends UTC without a zone, which would otherwise read as server-local time
  const tradedAt = String(last?.traded_at ?? '');
  const lastTradedAt = tradedAt ? new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(tradedAt) ? tradedAt : `${tradedAt}Z`) : null;

  const venues = [...new Set([...orders, ...deals].map((row) => String(row.source ?? '')).filter(Boolean))];

  return {
    bidUsd: bids.length ? Math.max(...bids) : null,
    askUsd: asks.length ? Math.min(...asks) : null,
    lastUsd: last ? priceOf(last) : null,
    lastTradedAt: lastTradedAt && !Number.isNaN(lastTradedAt.getTime()) ? lastTradedAt : null,
    bids: bids.length,
    asks: asks.length,
    trades: deals.length,
    venues,
  };
};

export type InBondMarket = ReturnType<typeof parseInBondMarket>;

export default parseInBondMarket;

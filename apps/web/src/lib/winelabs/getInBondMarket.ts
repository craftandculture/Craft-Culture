import parseInBondMarket from './parseInBondMarket';
import winelabsFetch from './winelabsFetch';

/**
 * London in-bond market for a 75cl bottle of one wine and vintage, in USD
 *
 * The exchanges' order book and recent trades (Bordeaux Index, BBX and the
 * other venues Wine Labs reads; not Liv-ex). Each call is 15 credits, so the
 * trades are only asked for when the order book has the wine: in our sample
 * of 24 wines, none had trades without orders.
 *
 * @param lwin7 - The wine
 * @param vintage - The vintage; LWIN's 1000 for non-vintage
 * @param withTrades - Ask for the trades too when the wine is listed (another 15 credits)
 * @returns Best bid, best ask, last trade and venues, all null when unlisted
 */
const getInBondMarket = async (lwin7: string, vintage: string, withTrades = true) => {
  const query = { lwin: lwin7, vintage, duty_code: 'IB', currency: 'USD', format: '750' };

  const orderbook = await winelabsFetch('exchange/orderbook', { ...query, limit: 100 });
  const listed = parseInBondMarket(orderbook, null, vintage);
  if (!withTrades || (!listed.bids && !listed.asks)) return listed;

  const trades = await winelabsFetch('exchange/trades', {
    ...query,
    limit: 50,
    sort_by: 'traded_at',
    sort_direction: 'desc',
  });
  return parseInBondMarket(orderbook, trades, vintage);
};

export default getInBondMarket;

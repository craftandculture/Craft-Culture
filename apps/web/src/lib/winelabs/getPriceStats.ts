import parsePriceStatsResponse from './parsePriceStatsResponse';
import winelabsFetch from './winelabsFetch';

/**
 * Latest worldwide retail price snapshot for a wine and vintage, in USD
 *
 * Retail and mostly duty-paid: a market check, never our in-bond price.
 *
 * @param lwin11 - LWIN7 followed by the four-digit vintage
 * @returns The latest snapshot, or null when there are no recent prices
 */
const getPriceStats = async (lwin11: string) =>
  parsePriceStatsResponse(
    await winelabsFetch('price_stats', { lwin: lwin11, region: 'world', currency: 'USD' }),
  );

export default getPriceStats;

import db from '@/database/client';
import { type WinelabsMarket, winelabsMarket } from '@/database/schema';
import getInBondMarket from '@/lib/winelabs/getInBondMarket';

/** Trades move slower than bids and asks, so they are asked for quarterly */
const TRADES_REFRESH_DAYS = 90;

/**
 * Ask Wine Labs for one wine's London in-bond market, in one bottle size, and save it
 *
 * The order book is always asked for (15 credits). The trades (another 15)
 * only when the wine is listed and its trades are over 90 days old, or when
 * `fresh` is set; otherwise the last trade already held is kept.
 *
 * @param wine - The wine, vintage and bottle size in ml
 * @param previous - The row already held for it, if any
 * @param fresh - Ask for the trades whatever their age (a price someone is about to quote on)
 * @returns The saved row
 */
const priceWineInBond = async (
  wine: { lwin11: string; lwin7: string; vintage: string; format: string },
  previous: WinelabsMarket | undefined,
  fresh = false,
) => {
  const tradesDue =
    fresh ||
    previous?.status !== 'priced' ||
    !previous.tradesCheckedAt ||
    previous.tradesCheckedAt.getTime() < Date.now() - TRADES_REFRESH_DAYS * 24 * 60 * 60 * 1000;

  const market = await getInBondMarket(wine.lwin7, wine.vintage, tradesDue, wine.format);
  const onBook = market.bidUsd !== null || market.askUsd !== null;
  const now = new Date();

  // Trades not asked this time: keep the last trade already held
  const trades =
    tradesDue || !onBook || !previous
      ? {
          lastUsd: market.lastUsd,
          lastTradedAt: market.lastTradedAt,
          trades: market.trades,
          tradesCheckedAt: onBook ? now : null,
          venues: market.venues,
        }
      : {
          lastUsd: previous.lastUsd,
          lastTradedAt: previous.lastTradedAt,
          trades: previous.trades,
          tradesCheckedAt: previous.tradesCheckedAt,
          venues: [...new Set([...market.venues, ...previous.venues])],
        };

  const values = {
    status: onBook || trades.lastUsd !== null ? 'priced' : 'unlisted',
    bidUsd: market.bidUsd,
    askUsd: market.askUsd,
    bids: market.bids,
    asks: market.asks,
    ...trades,
    checkedAt: now,
  };

  const [row] = await db
    .insert(winelabsMarket)
    .values({ lwin11: wine.lwin11, lwin7: wine.lwin7, vintage: wine.vintage, format: wine.format, ...values })
    .onConflictDoUpdate({ target: [winelabsMarket.lwin11, winelabsMarket.format], set: values })
    .returning();

  return row!;
};

export default priceWineInBond;

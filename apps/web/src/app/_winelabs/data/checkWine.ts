import type { StockWine } from '@/app/_winelabs/data/getStockWines';
import buildMatchQuery from '@/app/_winelabs/utils/buildMatchQuery';
import classifyMatch from '@/app/_winelabs/utils/classifyMatch';
import db from '@/database/client';
import { winelabsWines } from '@/database/schema';
import getPriceStats from '@/lib/winelabs/getPriceStats';
import getWineInfo from '@/lib/winelabs/getWineInfo';
import matchToLwin from '@/lib/winelabs/matchToLwin';

/**
 * Check one wine we hold against Wine Labs and cache the answer
 *
 * Three questions, at most 26 credits: does a name search land on our LWIN,
 * what are the wine's details and drinking window, and what does it sell for.
 * Details and price are asked of our own LWIN when it is a real one, since a
 * name search that misses does not mean Wine Labs lacks the wine; of an
 * internal code, only when the name search found a real LWIN to ask about.
 * Nothing is written to our stock or products.
 *
 * @param wine - A wine in stock, from getStockWines
 * @returns The match status recorded
 */
const checkWine = async (wine: StockWine) => {
  const match = await matchToLwin(
    buildMatchQuery({ producer: wine.producer, name: wine.name, vintage: wine.vintage }),
  );
  const matchStatus = classifyMatch(wine.lwin7, match?.lwin7 ?? null);

  const isInternal = wine.lwin7.startsWith('9');
  const lookupLwin7 = isInternal ? (match?.lwin7 ?? null) : wine.lwin7;

  const info = lookupLwin7 ? await getWineInfo(lookupLwin7) : null;
  const price = lookupLwin7 ? await getPriceStats(`${lookupLwin7}${wine.vintage}`) : null;

  const now = new Date();
  const values = {
    ourLwin7: wine.lwin7,
    ourName: wine.name,
    matchStatus,
    wlLwin7: match?.lwin7 ?? null,
    wlLwin: match?.lwin ?? null,
    wlId: match?.wlId ?? null,
    wlDisplayName: match?.displayName ?? null,
    info: info?.result ?? null,
    drinkFrom: info?.drinkFrom ?? null,
    drinkTo: info?.drinkTo ?? null,
    infoFetchedAt: lookupLwin7 ? now : null,
    price: price?.latest ?? null,
    priceMedianUsd: price?.medianUsd ?? null,
    priceCount: price?.count ?? null,
    priceFetchedAt: lookupLwin7 ? now : null,
    matchedAt: now,
  };

  await db
    .insert(winelabsWines)
    .values({ lwin11: wine.lwin11, ...values })
    .onConflictDoUpdate({ target: winelabsWines.lwin11, set: values });

  return matchStatus;
};

export default checkWine;

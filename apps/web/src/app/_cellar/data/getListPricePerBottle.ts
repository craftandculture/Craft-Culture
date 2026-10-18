import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';

/**
 * C&C's current in-bond list price per bottle, for wines we list today
 *
 * The same rows and the same In-Bond price that Available now and the trade
 * sheets show, read through `getCatalogueRows` rather than worked out again, so
 * a member's indicative value can never disagree with the price on our list.
 *
 * Keyed pack-agnostically with `lwinPakKeyOf`: a member's case of six and our
 * listed case of twelve are the same wine at the same price per bottle. Where
 * one wine is listed in several packs, the lowest price per bottle is used, so
 * the guide errs low rather than high.
 *
 * @example
 *   const listed = await getListPricePerBottle(lwins);
 *   const price = listed.get(lwinPakKeyOf(lwin18)) ?? null;
 *
 * @param lwins - The LWIN18s to look up
 * @returns In-bond list price per bottle in USD, for the wines currently listed
 */
const getListPricePerBottle = async (lwins: string[]) => {
  const prices = new Map<string, number>();

  if (lwins.length === 0) return prices;

  const wanted = new Set(lwins.map((lwin) => lwinPakKeyOf(lwin)));
  const rows = await getCatalogueRows();

  for (const row of rows) {
    const key = lwinPakKeyOf(row.lwin18);

    if (!wanted.has(key) || !(row.ibPerBottle > 0)) continue;

    const current = prices.get(key);

    if (current === undefined || row.ibPerBottle < current) {
      prices.set(key, row.ibPerBottle);
    }
  }

  return prices;
};

export default getListPricePerBottle;

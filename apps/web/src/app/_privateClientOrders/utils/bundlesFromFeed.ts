import type { CityDrinksRow } from '../../_distribution/utils/parseCityDrinksStock';

const PCO_NUMBER = /^PCO-\d{4}-\d{5}$/;

interface FeedBundle {
  orderNumber: string;
  sku: string;
  ref: string | null;
}

/**
 * The bundles a distributor's feed lists, one per PCO number
 *
 * City Drinks sells each PCO as a product named exactly after it. A PCO with
 * two different SKUs in one feed is left out rather than guessed at — that is
 * for a person to settle. Consigned rows are ignored: a PCO bundle is stock
 * they bought.
 *
 * @param rows - Feed rows (the latest snapshot, or a live pull)
 * @returns The unambiguous bundles, and the PCO numbers that were ambiguous
 */
const bundlesFromFeed = (
  rows: Pick<CityDrinksRow, 'outletCode' | 'ourCode' | 'productName' | 'regime'>[],
) => {
  const byOrder = new Map<string, FeedBundle[]>();

  for (const row of rows) {
    if (row.regime !== 'bought') continue;
    const orderNumber = row.productName.trim().toUpperCase();
    if (!PCO_NUMBER.test(orderNumber)) continue;

    const list = byOrder.get(orderNumber) ?? [];
    if (!list.some((b) => b.sku === row.outletCode)) {
      list.push({ orderNumber, sku: row.outletCode, ref: row.ourCode });
    }
    byOrder.set(orderNumber, list);
  }

  const bundles: FeedBundle[] = [];
  const ambiguous: string[] = [];
  for (const [orderNumber, list] of byOrder) {
    if (list.length === 1) bundles.push(list[0]!);
    else ambiguous.push(orderNumber);
  }

  return { bundles, ambiguous };
};

export default bundlesFromFeed;

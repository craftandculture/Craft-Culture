import getCatalogueInboundRows from '@/app/_wms/data/getCatalogueInboundRows';
import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';

export interface TradePrice {
  /** In-bond B2B price per bottle — what we bill a distributor */
  perBottle: number;
  /** Whether the price came from stock on hand or from wine still inbound */
  source: 'stock' | 'inbound';
}

/**
 * What we bill a distributor, per bottle, for every wine we can price
 *
 * The in-bond figure is the trade price: landed cost lifted by the in-bond
 * margin, which is the same number the trade price list publishes. Computing it
 * here from `wms_product_pricing` would be a second implementation of the cost
 * model, and the last time two places answered one pricing question differently
 * an edit landed on a row nobody read. So it comes from the catalogue feeds
 * themselves.
 *
 * Keyed pack-agnostically, because the price is per bottle and belongs to the
 * wine and vintage rather than the box it sits in. A client buying two bottles
 * out of a six is priced from the six; it is the same wine.
 *
 * Wine still inbound is priced too, and marked as such. An order for wine on
 * the water is a normal order — the invoice it produces is what moves the stock
 * out of the free zone once it lands — and refusing to price it would stop a
 * sale over a shipment's arrival date. Stock on hand wins where both know the
 * wine, since that is the parcel the order will actually be picked from.
 *
 * @example
 *   const prices = await resolveTradePrices();
 *   prices.get(lwinPakKeyOf('1104653-2020-06-00750'))?.perBottle; // 142.5
 *
 * @returns Trade price per bottle by pack-agnostic LWIN key
 */
const resolveTradePrices = async () => {
  const [inStock, inbound] = await Promise.all([
    getCatalogueRows(),
    getCatalogueInboundRows(),
  ]);

  const prices = new Map<string, TradePrice>();

  // Inbound first so stock on hand overwrites it
  for (const row of inbound) {
    if (!row.ibPerBottle || row.ibPerBottle <= 0) continue;

    prices.set(lwinPakKeyOf(row.lwin18), {
      perBottle: row.ibPerBottle,
      source: 'inbound',
    });
  }

  for (const row of inStock) {
    if (!row.ibPerBottle || row.ibPerBottle <= 0) continue;

    prices.set(lwinPakKeyOf(row.lwin18), {
      perBottle: row.ibPerBottle,
      source: 'stock',
    });
  }

  return prices;
};

export default resolveTradePrices;

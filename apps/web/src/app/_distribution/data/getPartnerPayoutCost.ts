import { and, eq, sql } from 'drizzle-orm';

import PRICE_LIST_RATES from '@/app/_wms/constants/priceListRates';
import lotShipmentCost from '@/app/_wms/utils/lotShipmentCost';
import lwinPakKey from '@/app/_wms/utils/lwinPakKey';
import ownerPricingJoin from '@/app/_wms/utils/ownerPricingJoin';
import ownerPricingReady from '@/app/_wms/utils/ownerPricingReady';
import pricePricingManagerRow from '@/app/_wms/utils/pricePricingManagerRow';
import stockPricingInput from '@/app/_wms/utils/stockPricingInput';
import stockPricingSelect from '@/app/_wms/utils/stockPricingSelect';
import db from '@/database/client';
import {
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';

import wineKey from '../utils/wineKey';

export interface PartnerPayoutCost {
  key: string;
  /** Import + logistics + override per bottle, USD */
  perBottle: number;
  importPerBottle: number | null;
  logisticsPerBottle: number;
  overridePerBottle: number;
  /** Where the figure came from, so a statement line can be traced */
  from: string;
  /** The supplier codes the lot is held under (W-codes), for dated price cuts */
  codes: string[];
}

/**
 * What C&C pays a partner for a bottle of theirs that sold
 *
 * Sophie's rule (19 Nov 2026): the Pricing Manager's import + freight
 * (logistics) + cost override on that partner's own lot, which is the landed
 * cost less the $2.50 transfer C&C keeps. Read through the Pricing Manager's
 * own select and price function, so the figure on a statement is the figure on
 * that screen and is fixed in one place.
 *
 * Stock rows are read whatever their quantity, so a wine that has sold out
 * still prices its last month. A wine with no stock row for this owner is left
 * out, and the caller falls back to the figure remembered for it.
 *
 * @example
 *   const costs = await getPartnerPayoutCost(partnerId, [wineKey(lwin18)]);
 *
 * @param partnerId - The owner's partner record (wms_stock.owner_id)
 * @param keys - Wine keys from wineKey()
 * @param aliases - Other codes each key answers to (W-codes, merged codes)
 * @returns One cost per key that has a costed lot
 */
const getPartnerPayoutCost = async (
  partnerId: string,
  keys: string[],
  aliases: Map<string, Set<string>> = new Map(),
) => {
  const result = new Map<string, PartnerPayoutCost>();

  if (keys.length === 0) return result;

  /*
    Every code a wine answers to, pointing back at the key asked for. Crurated
    stock is held under W-codes (W12008024-2021-06-00750) while City Drinks
    sell and we invoice under the LWIN (1243561-2021-06-00750), or the other
    way round, so a statement line found no lot and read as "no cost".
  */
  const target = new Map<string, string>();

  for (const key of keys) {
    target.set(key, key);

    for (const code of aliases.get(key) ?? []) {
      if (!target.has(code)) target.set(code, key);
    }
  }

  const rows = await db
    .select({
      lwin18: wmsStock.lwin18,
      supplierSku: sql<string | null>`MAX(${wmsStock.supplierSku})`,
      ...stockPricingSelect,
      shipmentNumber: sql<string | null>`(
        SELECT ls.shipment_number FROM logistics_shipments ls
        WHERE ls.id = (array_agg(ship.shipment_id ORDER BY ${wmsStock.receivedAt} DESC NULLS LAST))[1]
      )`,
    })
    .from(wmsStock)
    .leftJoin(
      wmsProductPricing,
      sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`,
    )
    .leftJoin(ownerPricingJoin(await ownerPricingReady()), sql`true`)
    .leftJoin(lotShipmentCost, sql`true`)
    .leftJoin(
      wmsOwnerPricingSettings,
      eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId),
    )
    .where(and(eq(wmsStock.ownerId, partnerId)))
    .groupBy(wmsStock.lwin18);

  for (const raw of rows) {
    const squash = (value: string | null | undefined) =>
      (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const key = [
      wineKey(raw.lwin18),
      squash(raw.lwin18.split('-')[0]),
      squash(raw.supplierSku),
    ]
      .map((code) => (code ? target.get(code) : undefined))
      .find((found): found is string => Boolean(found));

    if (!key) continue;

    const input = stockPricingInput(raw);
    const priced = pricePricingManagerRow(input, PRICE_LIST_RATES);

    if (priced.landed == null) continue;

    const importPerBottle = input.importPricePerBottle ?? null;
    const overridePerBottle = input.costOverridePerBottle ?? 0;
    const perBottle =
      Math.round((priced.landed - priced.transfer) * 100) / 100;

    const candidate: PartnerPayoutCost = {
      key,
      perBottle,
      importPerBottle,
      logisticsPerBottle: priced.logistics,
      overridePerBottle,
      from: `Pricing Manager${raw.shipmentNumber ? ` (${raw.shipmentNumber})` : ''}`,
      codes: [squash(raw.lwin18.split('-')[0]), squash(raw.supplierSku)].filter(
        (code) => /^W\d+$/.test(code),
      ),
    };

    /* Several packs of one wine: the dearest lot, so no owner is underpaid */
    const existing = result.get(key);

    if (!existing || candidate.perBottle > existing.perBottle) {
      result.set(key, candidate);
    }
  }

  return result;
};

export default getPartnerPayoutCost;

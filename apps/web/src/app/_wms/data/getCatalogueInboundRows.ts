import { and, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  products,
  wmsOwnerPricingSettings,
  wmsProductPricing,
} from '@/database/schema';

import type { CatalogueRow } from './getCatalogueRows';
import inboundLineKey from '../utils/inboundLineKey';
import inboundPricingInput from '../utils/inboundPricingInput';
import inboundPricingSelect from '../utils/inboundPricingSelect';
import INBOUND_SHIPMENT_STATUSES from '../utils/inboundShipmentStatuses';
import lwinPakKey from '../utils/lwinPakKey';
import priceListPrice from '../utils/priceListPrice';
import sumAcrossPricingRows from '../utils/sumAcrossPricingRows';

export interface CatalogueInboundRow extends CatalogueRow {
  /** Earliest ETA across the shipments carrying this wine, if known */
  eta: Date | null;
}

export interface CatalogueInboundFilters {
  category?: string; // 'Wine' | 'Spirits' | 'RTD'
  search?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The larger of two values, ignoring nulls, as SQL MAX() does */
const maxOf = <T extends string | number>(a: T | null, b: T | null) =>
  a == null ? b : b == null ? a : b > a ? b : a;

/** Shipment statuses that mean "bought, not yet received into wms_stock". */

/** HS codes per category — inbound lines carry no category of their own. */
const HS_CODES: Record<string, readonly string[] | undefined> = {
  Wine: ['22042100', '22041000'],
  Spirits: [
    '22084000',
    '22083000',
    '22082000',
    '22089090',
    '22085000',
    '22087000',
    '22086000',
  ],
  RTD: ['22030000', '22060000'],
};

/**
 * In-transit ("inbound") catalogue feed — stock bought and on its way to the
 * UAE bonded warehouse but not yet received into wms_stock.
 *
 * Each shipment's line is priced exactly as the Pricing Manager prices its
 * in-transit row — the same inputs (inboundPricingSelect) and the same function
 * (pricePricingManagerRow via priceListPrice) — and the wine lists once at the
 * highest shipment's price. Margin rates come from the shipment's own partner,
 * falling back to the house defaults when a shipment has no partner.
 *
 * @param filters - Optional category / search narrowing
 * @returns One row per wine in transit, with its earliest ETA
 */
/**
 * The first shipment the release gate applies to. Everything numbered below
 * this was already on the price lists and is deliberately left alone.
 */
const FIRST_GATED_SHIPMENT = 'SHP-2026-0012';

const getCatalogueInboundRows = async (
  filters: CatalogueInboundFilters = {},
): Promise<CatalogueInboundRow[]> => {
  const where = [
    eq(logisticsShipments.type, 'inbound'),
    /*
      Bottles, not cases, decide whether there is anything to sell.

      This read cases > 0, which was true of every line while a bottle-billed
      one was recorded as a case of itself. Now that such a line correctly
      carries zero cases — its bottles travel in a mixed carton — the test
      silently dropped it, and seven of the fourteen wines on the invoice that
      prompted the change went missing from the in-transit price list. They are
      bought, in transit and sellable; only the packaging is shared.
    */
    /*
      Either column may carry the quantity.

      A cased line fills `cases`; a line billed loose fills `total_bottles`.
      Testing only one of them dropped whichever kind the other describes —
      first cases-only hid bottle-billed wine, then bottles-only hid cased
      wine, and the Pricing Manager, which tests neither, went on showing 51
      in transit while this feed served 50 rows of nothing. Accept a line that
      has either.
    */
    sql`(COALESCE(${logisticsShipmentItems.cases}, 0) > 0
         OR COALESCE(${logisticsShipmentItems.totalBottles}, 0) > 0)`,

    // Same allowlist the Pricing Manager's inbound toggle uses. It deliberately
    // omits draft, partially_received, delivered and cancelled: once a shipment
    // starts being received its stock is in wms_stock, so including those here
    // would list the same bottles twice across the two feeds.
    inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
    /*
      A line inherits its shipment unless it says otherwise, so a whole
      storage shipment is one setting and a mixed one is a handful of
      corrections. Caught here as well as at receiving, because in-transit
      goods are offered on the price lists before they ever become stock.
    */
    sql`COALESCE(${logisticsShipmentItems.notForSale}, ${logisticsShipments.notForSale}) = false`,
    /*
      Shipments from SHP-2026-0012 onwards stay off the price lists until their
      pricing is released. Before that number the book is left exactly as it
      was: an earlier attempt at this gated EVERY wine and required a backfill
      to re-release the standing book, which missed wines that had no pricing
      row at all and took a third of the live list offline.

      Framed as a positive rule — "these shipments need releasing" — nothing
      already published can disappear, whatever the state of the pricing table.

      Until it is released, in-transit wine carries no allocated freight and no
      agreed margin, so what would publish is the buy price plus a token
      markup.

      Matched pack-agnostically, as prices are: releasing a wine releases the
      wine, not one pack of it. On the exact code, a 4-pack line of something
      released as a 2-pack stayed off the list with no way to tell why.

      And matched against THIS shipment's owner. The flag used to sit on the
      pricing row, keyed on the wine alone, so releasing C&C's own stock of a
      wine published every other holding of it — a client's consignment reached
      the price list because we had listed ours.
    */
    sql`(
      ${logisticsShipments.shipmentNumber} < ${FIRST_GATED_SHIPMENT}
      OR EXISTS (
        SELECT 1 FROM wms_product_pricing rel
         WHERE ${lwinPakKey(sql`rel.lwin18`)} = ${inboundLineKey()}
           AND rel.pricing_released_at IS NOT NULL
      )
    )`,
  ];
  if (filters.search) {
    const q = `%${filters.search}%`;
    where.push(
      sql`(${logisticsShipmentItems.productName} ILIKE ${q} OR ${logisticsShipmentItems.producer} ILIKE ${q})`,
    );
  }
  if (filters.category) {
    const hsCodes = HS_CODES[filters.category];
    if (hsCodes)
      where.push(inArray(logisticsShipmentItems.hsCode, [...hsCodes]));
  }

  /*
    Priced per SHIPMENT, as the Pricing Manager prices it, then one line per
    wine+pack+size at the highest shipment's price.

    This grouped across shipments and took the highest cost, the highest
    landed cost and the highest of every margin and override separately, so a
    wine arriving on two consignments listed at a price neither of them had in
    the Pricing Manager. It also fell back to a 0% In Bond margin where the
    Pricing Manager uses 10%, listing unmargined wine at landed cost.
  */
  const lineKey = sql`COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName}) || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12') || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')`;
  const shipmentLineKey = sql`${logisticsShipmentItems.shipmentId}::text || '|' || ${lineKey}`;

  const shipmentRows = await db
    .select({
      key: sql<string>`MAX(${lineKey})`,
      ...inboundPricingSelect,
      lwin: sql<string | null>`MAX(${logisticsShipmentItems.lwin})`,
      product: sql<string>`MAX(${logisticsShipmentItems.productName})`,
      producer: sql<string | null>`MAX(${logisticsShipmentItems.producer})`,
      caseConfig: sql<
        number | null
      >`MAX(${logisticsShipmentItems.bottlesPerCase})::int`,
      bottleSizeMl: sql<
        number | null
      >`MAX(${logisticsShipmentItems.bottleSizeMl})::int`,
      cases: sql<number>`${sumAcrossPricingRows(
        sql`COALESCE(${logisticsShipmentItems.cases}, 0)`,
      )}::int`,
      /*
        What is actually offered, from whichever column holds it.

        total_bottles alone reports zero for a cased line that never had it
        filled in; cases times pack understates a line billed loose. Prefer the
        explicit bottle count and fall back to the cased arithmetic, so a row
        can no longer be served with a price and no quantity.
      */
      bottles: sql<number>`${sumAcrossPricingRows(
        sql`COALESCE(
          NULLIF(${logisticsShipmentItems.totalBottles}, 0),
          COALESCE(${logisticsShipmentItems.cases}, 0)
            * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
        )`,
      )}::int`,
      /*
        Decoded as the eta column is. A bare MIN() comes back from the driver as
        text, and the feed then called toISOString on a string: every in-transit
        request failed the day shipments began carrying ETAs.
      */
      eta: sql<Date | null>`MIN(${logisticsShipments.eta})`.mapWith(logisticsShipments.eta),
      /*
        Already on our floor, or still on the move?

        at_warehouse means the pallet is at goods-in awaiting booking in. It is
        not in wms_stock so it belongs on this feed, but calling it "arriving in
        ~7 days" is wrong when it is already here. True only when every shipment
        behind the row is at the warehouse — a wine arriving on two shipments is
        still partly in transit.
      */
      atWarehouse: sql<boolean>`BOOL_AND(${logisticsShipments.status} = 'at_warehouse')`,
      owner: sql<string | null>`MAX(${partners.businessName})`,
    })
    .from(logisticsShipmentItems)
    .innerJoin(
      logisticsShipments,
      eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
    )
    .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
    .leftJoin(
      wmsProductPricing,
      sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(logisticsShipmentItems.lwin)}`,
    )
    .leftJoin(
      wmsOwnerPricingSettings,
      eq(wmsOwnerPricingSettings.ownerId, logisticsShipments.partnerId),
    )
    .where(and(...where))
    .groupBy(shipmentLineKey);

  /* One line per wine+pack+size: quantities summed, every shipment priced */
  type ShipmentRow = (typeof shipmentRows)[number];
  const byKey = new Map<
    string,
    ShipmentRow & {
      holders: ReturnType<typeof inboundPricingInput<ShipmentRow>>[];
    }
  >();

  for (const row of shipmentRows) {
    const line = byKey.get(row.key);

    if (!line) {
      byKey.set(row.key, {
        ...row,
        cases: Number(row.cases),
        bottles: Number(row.bottles),
        holders: [inboundPricingInput(row)],
      });
      continue;
    }

    line.holders.push(inboundPricingInput(row));
    line.cases += Number(row.cases);
    line.bottles += Number(row.bottles);
    line.eta =
      line.eta == null
        ? row.eta
        : row.eta == null || line.eta <= row.eta
          ? line.eta
          : row.eta;
    line.atWarehouse = line.atWarehouse && row.atWarehouse;
    line.lwin = maxOf(line.lwin, row.lwin);
    line.product = maxOf(line.product, row.product) ?? line.product;
    line.producer = maxOf(line.producer, row.producer);
    line.caseConfig = maxOf(line.caseConfig, row.caseConfig);
    line.bottleSizeMl = maxOf(line.bottleSizeMl, row.bottleSizeMl);
    line.category = maxOf(line.category, row.category);
    line.owner = maxOf(line.owner, row.owner);
  }

  const rows = [...byKey.values()];

  // Region/country from the product master, matched on LWIN7 (the wine), since
  // an inbound line's pack digits need not match its product-master row.
  const lwin7Of = (lwin: string) => lwin.slice(0, 7);
  const lwin7s = [
    ...new Set(
      rows
        .map((r) => r.lwin)
        .filter((l): l is string => !!l && /^\d{7}/.test(l))
        .map(lwin7Of),
    ),
  ];
  const regionMap = new Map<
    string,
    { region: string | null; country: string | null }
  >();
  if (lwin7s.length > 0) {
    const regionRows = await db
      .select({
        lwin7: sql<string>`LEFT(${products.lwin18}, 7)`,
        region: products.region,
        country: products.country,
      })
      .from(products)
      .where(inArray(sql`LEFT(${products.lwin18}, 7)`, lwin7s));
    regionRows.forEach((r) => {
      const prev = regionMap.get(r.lwin7);
      if (!prev || (!prev.region && r.region) || (!prev.country && r.country)) {
        regionMap.set(r.lwin7, {
          region: r.region ?? prev?.region ?? null,
          country: r.country ?? prev?.country ?? null,
        });
      }
    });
  }

  return rows.map((r) => {
    // The Pricing Manager's own price for each shipment, highest kept
    const { ibPerBottle, pcPerBottle } = priceListPrice(r.holders);
    const cc = r.caseConfig || 1;
    const lwin = r.lwin ?? r.key;
    const region = /^\d{7}/.test(lwin)
      ? regionMap.get(lwin7Of(lwin))
      : undefined;
    const vintage = /^\d{7}-(\d{4})-/.test(lwin)
      ? Number(lwin.slice(8, 12))
      : null;
    return {
      lwin18: lwin,
      product: r.product,
      producer: r.producer,
      vintage,
      region: region?.region ?? null,
      country: region?.country ?? null,
      category: r.category,
      owner: r.owner,
      caseConfig: cc,
      bottleSize: r.bottleSizeMl != null ? `${r.bottleSizeMl / 10}cl` : null,
      availableCases: r.cases,
      availableBottles: r.bottles,
      stage: r.atWarehouse
        ? ('at_warehouse' as const)
        : ('in_transit' as const),
      ibPerBottle: round2(ibPerBottle),
      ibPerCase: round2(ibPerBottle * cc),
      pcPerBottle: round2(pcPerBottle),
      pcPerCase: round2(pcPerBottle * cc),
      eta: r.eta,
    };
  });
};

export default getCatalogueInboundRows;

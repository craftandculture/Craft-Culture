import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { SELLABLE_STATUSES } from '@/app/_consignment/utils/mandateStatuses';
import db from '@/database/client';
import {
  products,
  saleMandates,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';

import lotShipmentCost from '../utils/lotShipmentCost';
import lwinPakKey from '../utils/lwinPakKey';
import onPriceListConditions from '../utils/onPriceListConditions';
import ownerPricingJoin from '../utils/ownerPricingJoin';
import ownerPricingReady from '../utils/ownerPricingReady';
import priceListPrice from '../utils/priceListPrice';
import stockPricingInput from '../utils/stockPricingInput';
import stockPricingSelect from '../utils/stockPricingSelect';
import sumAcrossPricingRows from '../utils/sumAcrossPricingRows';

export interface CatalogueRow {
  lwin18: string;
  product: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  category: string | null;
  owner: string | null;
  caseConfig: number;
  bottleSize: string | null;
  availableCases: number;
  availableBottles: number;
  /** In-Bond B2B (trade) price */
  ibPerBottle: number;
  ibPerCase: number;
  /** Private-Client (retail, home-delivery) price */
  pcPerBottle: number;
  pcPerCase: number;
}

export interface CatalogueFilters {
  category?: string; // 'Wine' | 'Spirits' | 'RTD'
  ownerId?: string;
  search?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The larger of two values, ignoring nulls, as SQL MAX() does */
const maxOf = <T extends string | number>(a: T | null, b: T | null) =>
  a == null ? b : b == null ? a : b > a ? b : a;

/**
 * Single source of truth for the consumer catalogue feed.
 *
 * Groups live WMS stock (only availableCases > 0) per wine and owner, exactly
 * as the Pricing Manager does, prices each holder with the Pricing Manager's
 * own function (pricePricingManagerRow via priceListPrice) and lists each wine
 * once at the highest holder's price — so the portals carry the Pricing
 * Manager's In-Bond (B2B/trade) and Private-Client prices to the cent.
 * Landed = import + logistics + transfer + override, from the newest lot; In
 * Bond = Landed ÷ (1 − InBond%); PC = In Bond ÷ (1 − PC%).
 *
 * @param filters - Optional category / owner / search narrowing
 * @returns One row per product (lwin18) with live availability + IB & PC prices
 */
const getCatalogueRows = async (
  filters: CatalogueFilters = {},
): Promise<CatalogueRow[]> => {
  /*
    Stock held for its owner never reaches a price surface. It sits in the
    warehouse like anything else, so availability alone cannot tell them
    apart — which is why a client's cellar in storage used to appear here
    with an in-bond and a private-client price computed for it.
  */
  /*
    Wine placed with a distributor is theirs to sell, and leaving it here would
    offer the same bottles twice. The rules live in onPriceListConditions so the
    parcels a cellar order is filled from are exactly the rows counted here.
  */
  const where = onPriceListConditions();
  if (filters.category) {
    where.push(
      filters.category === 'Wine'
        ? or(eq(wmsStock.category, 'Wine'), sql`${wmsStock.category} IS NULL`)!
        : eq(wmsStock.category, filters.category),
    );
  }
  if (filters.ownerId) where.push(eq(wmsStock.ownerId, filters.ownerId));
  if (filters.search) {
    const q = `%${filters.search}%`;
    where.push(
      or(
        sql`${wmsStock.productName} ILIKE ${q}`,
        sql`${wmsStock.producer} ILIKE ${q}`,
      )!,
    );
  }

  /*
    The highest price a member has asked for this wine, across every mandate
    still live on it. The catalogue prices from the cost model — landed cost and
    our margins — which knows nothing about what a member agreed to receive, so
    accepting a mandate would have listed their wine at our number rather than
    theirs. Joined pack-agnostically because the ask is per bottle; bottle size
    is still kept apart, since a magnum is a different thing.
  */
  const liveMandates = db
    .select({
      lwinKey: saleMandates.lwinKey,
      ask: sql<number>`MAX(${saleMandates.askPerBottleUsd})`.as('ask'),
    })
    .from(saleMandates)
    .where(inArray(saleMandates.status, [...SELLABLE_STATUSES]))
    .groupBy(saleMandates.lwinKey)
    .as('live_mandates');

  /*
    One group per wine PER OWNER, exactly as the Pricing Manager groups its
    rows, selecting exactly what it selects (stockPricingSelect).

    This grouped by wine alone and took the highest of every input across all
    lots and owners, so a wine never carried the Pricing Manager's price unless
    it had one lot and one owner. Alain's Fourrier Chambolle, bought at $170
    and $282, listed off the dearer lot and the largest freight of any lot while
    the Pricing Manager priced the newest; a wine two owners held listed one
    owner's import with the other's override and margin; and the C&C logistics
    fallback and the Crurated $0 transfer were tested against whichever owner
    name sorted last.
  */
  const ownerRows = await db
    .select({
      lwin18: wmsStock.lwin18,
      ownerId: wmsStock.ownerId,
      ...stockPricingSelect,
      mandateAsk: sql<number | null>`MAX(${liveMandates.ask})`,
      product: sql<string>`MAX(${wmsStock.productName})`,
      producer: sql<string | null>`MAX(${wmsStock.producer})`,
      vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
      owner: sql<string | null>`MAX(${wmsStock.ownerName})`,
      caseConfig: sql<number>`MAX(${wmsStock.caseConfig})`,
      bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
      availableCases: sql<number>`${sumAcrossPricingRows(wmsStock.availableCases)}::int`,
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
    .leftJoin(
      liveMandates,
      sql`${liveMandates.lwinKey} = ${lwinPakKey(wmsStock.lwin18)}`,
    )
    .where(and(...where))
    .groupBy(wmsStock.lwin18, wmsStock.ownerId);

  /* Then one line per wine: quantities summed, every holder priced */
  type OwnerRow = (typeof ownerRows)[number];
  const byLwin = new Map<
    string,
    OwnerRow & { holders: ReturnType<typeof stockPricingInput<OwnerRow>>[] }
  >();

  for (const row of ownerRows) {
    const line = byLwin.get(row.lwin18);

    if (!line) {
      byLwin.set(row.lwin18, {
        ...row,
        availableCases: Number(row.availableCases),
        holders: [stockPricingInput(row)],
      });
      continue;
    }

    line.holders.push(stockPricingInput(row));
    line.availableCases += Number(row.availableCases);
    line.mandateAsk = maxOf(line.mandateAsk, row.mandateAsk);
    line.product = maxOf(line.product, row.product) ?? line.product;
    line.producer = maxOf(line.producer, row.producer);
    line.vintage = maxOf(line.vintage, row.vintage);
    line.category = maxOf(line.category, row.category);
    line.owner = maxOf(line.owner, row.owner);
    line.caseConfig = maxOf(line.caseConfig, row.caseConfig) ?? line.caseConfig;
    line.bottleSize = maxOf(line.bottleSize, row.bottleSize);
  }

  const rows = [...byLwin.values()];

  const lwins = rows.map((r) => r.lwin18);
  if (lwins.length === 0) return [];

  // Region/country from the product master (wms_stock doesn't carry region).
  // Matched on LWIN7 (the first 7 digits — the wine itself), NOT the full
  // LWIN18: the pack digits differ between a stock line and its product-master
  // row, so an exact match returns nothing. Region and country are properties
  // of the wine, so they hold across every vintage, pack and bottle size.
  const lwin7Of = (lwin18: string) => lwin18.slice(0, 7);
  const lwin7s = [...new Set(lwins.map(lwin7Of))];
  const regionRows = await db
    .select({
      lwin7: sql<string>`LEFT(${products.lwin18}, 7)`,
      region: products.region,
      country: products.country,
    })
    .from(products)
    .where(inArray(sql`LEFT(${products.lwin18}, 7)`, lwin7s));
  const regionMap = new Map<
    string,
    { region: string | null; country: string | null }
  >();
  regionRows.forEach((r) => {
    const prev = regionMap.get(r.lwin7);
    // Prefer the first row that actually carries a region/country.
    if (!prev || (!prev.region && r.region) || (!prev.country && r.country)) {
      regionMap.set(r.lwin7, {
        region: r.region ?? prev?.region ?? null,
        country: r.country ?? prev?.country ?? null,
      });
    }
  });

  return rows.map((r) => {
    const { ibPerBottle, pcPerBottle } = priceListPrice(r.holders, r.mandateAsk);

    const cc = r.caseConfig || 1;
    const region = regionMap.get(lwin7Of(r.lwin18));
    return {
      lwin18: r.lwin18,
      product: r.product,
      producer: r.producer,
      vintage: r.vintage,
      region: region?.region ?? null,
      country: region?.country ?? null,
      category: r.category,
      owner: r.owner,
      caseConfig: cc,
      bottleSize: r.bottleSize,
      availableCases: r.availableCases,
      availableBottles: r.availableCases * cc,
      ibPerBottle: round2(ibPerBottle),
      ibPerCase: round2(ibPerBottle * cc),
      pcPerBottle: round2(pcPerBottle),
      pcPerCase: round2(pcPerBottle * cc),
    };
  });
};

export default getCatalogueRows;

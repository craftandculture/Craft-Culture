import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';
import { SELLABLE_STATUSES } from '@/app/_consignment/utils/mandateStatuses';
import db from '@/database/client';
import {
  products,
  saleMandates,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';

import isCraftCultureOwner from '../utils/isCraftCultureOwner';
import lotShipmentCost from '../utils/lotShipmentCost';
import lwinPakKey from '../utils/lwinPakKey';
import onPriceListConditions from '../utils/onPriceListConditions';
import ownerPricingJoin, { ownerPriced } from '../utils/ownerPricingJoin';
import type { OwnerPricedField } from '../utils/ownerPricingJoin';
import ownerPricingReady from '../utils/ownerPricingReady';
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
const isZeroTransferOwner = (owner: string | null) =>
  !!owner && /(cru wine|crurated)/i.test(owner);

/**
 * Single source of truth for the consumer catalogue feed.
 *
 * Groups live WMS stock (only availableCases > 0) with the Pricing Manager's
 * per-owner rates and derives the same In-Bond (B2B/trade) and Private-Client
 * (retail) prices shown on the Pricing Manager screen — so the public portals
 * match it to the cent. Price = Landed ÷ (1 − InBond%), then ÷ (1 − PC%), where
 * Landed = importPaid + logistics + transfer + override. Import is chosen by the
 * Pricing Manager's rule: the lot's own invoice line, then a typed import price,
 * then the nearest line for the wine (lotShipmentCost).
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

  /**
   * Exact code first, any sibling pack second. A price set specifically on the
   * single must beat the case price it was cut from — MAX() alone would let the
   * (usually higher) case price override a deliberate single-bottle rate.
   */
  /* Each holder's own figure where a wine several own is priced per owner */
  const preferExact = (field: OwnerPricedField) =>
    sql`COALESCE(
      MAX(CASE WHEN ${wmsProductPricing.lwin18} = ${wmsStock.lwin18} THEN ${ownerPriced(field)} END),
      MAX(${ownerPriced(field)})
    )`;

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

  const rows = await db
    .select({
      lwin18: wmsStock.lwin18,
      mandateAsk: sql<number | null>`MAX(${liveMandates.ask})`,
      product: sql<string>`MAX(${wmsStock.productName})`,
      producer: sql<string | null>`MAX(${wmsStock.producer})`,
      vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
      category: sql<string | null>`MAX(${wmsStock.category})`,
      owner: sql<string | null>`MAX(${wmsStock.ownerName})`,
      caseConfig: sql<number>`MAX(${wmsStock.caseConfig})`,
      bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
      availableCases: sql<number>`${sumAcrossPricingRows(wmsStock.availableCases)}::int`,
      importPrice: sql<number | null>`${preferExact('importPricePerBottle')}`,
      /*
        The lot's own cost, as the Pricing Manager reads it. This used to be the
        latest shipment line for the wine from anyone, so Alain's Fourrier
        Chambolle 1er VV 2021 (invoiced $282.07) listed at $203.22 off another
        lot's $170 line, below what it cost. Where several lots share a code the
        highest wins, so no owner's bottles sell under their own cost.
      */
      ownLineCost: sql<number | null>`MAX(CASE WHEN ship.own_line THEN NULLIF(ship.product_cost, 0) END)`,
      lotCost: sql<number | null>`MAX(NULLIF(ship.product_cost, 0))`,
      lotFreight: sql<number | null>`MAX(CASE WHEN ship.landed_cost IS NOT NULL AND ship.product_cost IS NOT NULL THEN GREATEST(ship.landed_cost - ship.product_cost, 0) END)`,
      logistics: sql<number | null>`${preferExact('logisticsPerBottle')}`,
      transfer: sql<number | null>`${preferExact('transferPricePerBottle')}`,
      override: sql<number | null>`${preferExact('costOverridePerBottle')}`,
      selling: sql<number | null>`${preferExact('sellingPricePerBottle')}`,
      /*
        A margin set on the wine beats the owner's default, as it does on the
        pricing screen.

        This read only the owner's rates, so a margin typed against one wine
        moved its price in the Pricing Manager and nowhere a customer could see
        — Tignanello 2022 quoted at $174.79 internally and $165.08 on the price
        list, the difference being the 10% owner default the catalogue kept
        applying. A price the business has decided on has to be the price that
        publishes.
      */
      /*
        A spirit's old single margin (sell_margin_pct, only ever set on spirits
        and RTD) counts as its In Bond margin, as the Pricing Manager shows it.
      */
      inbondPct: sql<number | null>`COALESCE(
        ${preferExact('b2bMarginPct')},
        ${preferExact('sellMarginPct')},
        MAX(${wmsOwnerPricingSettings.inbondMarginPct})
      )`,
      pcPct: sql<number | null>`COALESCE(
        ${preferExact('pcMarginPct')},
        MAX(${wmsOwnerPricingSettings.pcMarginPct})
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
    .leftJoin(
      liveMandates,
      sql`${liveMandates.lwinKey} = ${lwinPakKey(wmsStock.lwin18)}`,
    )
    .where(and(...where))
    .groupBy(wmsStock.lwin18);

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
    const manualImport =
      r.importPrice && r.importPrice > 0 ? r.importPrice : null;
    // An own invoice line beats a typed import price, as on the Pricing Manager
    const importPaid =
      (r.ownLineCost != null ? Number(r.ownLineCost) : null) ??
      manualImport ??
      (r.lotCost != null ? Number(r.lotCost) : 0);
    const systemLogistics =
      r.lotFreight != null ? Math.max(0, round2(Number(r.lotFreight))) : 0;
    const logistics =
      r.logistics ??
      (systemLogistics > 0
        ? systemLogistics
        : isCraftCultureOwner(r.owner) &&
            (r.category === 'Wine' || r.category == null)
          ? 22.5
          : 0);
    const transfer = r.transfer ?? (isZeroTransferOwner(r.owner) ? 0 : 2.5);
    const override = r.override ?? 0;
    const landed =
      importPaid > 0 || override !== 0
        ? importPaid + logistics + transfer + override
        : 0;
    const inbondPct = r.inbondPct ?? 0;
    const ib = landed > 0 ? landed / (1 - inbondPct / 100) : 0;
    const pc =
      r.pcPct != null && r.pcPct < 100
        ? landed > 0
          ? ib / (1 - r.pcPct / 100)
          : 0
        : (r.selling ?? 0);
    /*
      A member's ask is a floor, not a replacement. One line per wine is kept
      deliberately: splitting the row per owner would put the same wine on the
      price list twice at two prices, let a buyer infer that parcels belong to
      different people, and silently break the LPO matcher, which keys a Map on
      lwin18 alone. Taking the higher figure instead means a member is never
      undersold, and where we hold the same wine ourselves it simply sells for
      more. An ask too high to sell is what the review step exists to refuse.
    */
    const ask = r.mandateAsk ? Number(r.mandateAsk) : 0;

    /*
      Grossed up at the HIGHER of the two commission rates, on both surfaces.

      The rate depends on who buys, not on which list they bought from — a
      collector and a trade buyer can take the same bottle off the same in-bond
      price at 2.5% and 5%. Applying the collector rate to the private-client
      price treated the surface as if it decided the rate, which would let a
      trade sale off that list return the member less than they asked for. The
      member receives their ask in full either way, so the floor has to cover
      the worst case and the surplus on a collector sale is ours.
    */
    const floor =
      ask > 0
        ? ask /
          (1 -
            Math.max(COMMISSION_RATES.trade, COMMISSION_RATES.collector) / 100)
        : 0;

    const ibFinal = Math.max(ib, floor);
    const pcFinal = Math.max(pc, floor);

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
      ibPerBottle: round2(ibFinal),
      ibPerCase: round2(ibFinal * cc),
      pcPerBottle: round2(pcFinal),
      pcPerCase: round2(pcFinal * cc),
    };
  });
};

export default getCatalogueRows;

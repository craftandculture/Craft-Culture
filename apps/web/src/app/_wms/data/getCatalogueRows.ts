import { and, desc, eq, gt, inArray, isNotNull, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  products,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';

import lwinPakKey from '../utils/lwinPakKey';

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
const isCraftCulture = (owner: string | null) =>
  !!owner && /craft.*culture/i.test(owner);
const isZeroTransferOwner = (owner: string | null) =>
  !!owner && /(cru wine|crurated)/i.test(owner);

/**
 * Single source of truth for the consumer catalogue feed.
 *
 * Groups live WMS stock (only availableCases > 0) with the Pricing Manager's
 * per-owner rates and derives the same In-Bond (B2B/trade) and Private-Client
 * (retail) prices shown on the Pricing Manager screen — so the public portals
 * match it to the cent. Price = Landed ÷ (1 − InBond%), then ÷ (1 − PC%), where
 * Landed = importPaid + logistics + transfer + override. Import falls back to
 * the latest shipment's product cost (pack-agnostic) when no manual price.
 *
 * @param filters - Optional category / owner / search narrowing
 * @returns One row per product (lwin18) with live availability + IB & PC prices
 */
const getCatalogueRows = async (
  filters: CatalogueFilters = {},
): Promise<CatalogueRow[]> => {
  const where = [gt(wmsStock.availableCases, 0)];
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
  const preferExact = (col: typeof wmsProductPricing.importPricePerBottle) =>
    sql`COALESCE(
      MAX(CASE WHEN ${wmsProductPricing.lwin18} = ${wmsStock.lwin18} THEN ${col} END),
      MAX(${col})
    )`;

  const rows = await db
    .select({
      lwin18: wmsStock.lwin18,
      product: sql<string>`MAX(${wmsStock.productName})`,
      producer: sql<string | null>`MAX(${wmsStock.producer})`,
      vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
      category: sql<string | null>`MAX(${wmsStock.category})`,
      owner: sql<string | null>`MAX(${wmsStock.ownerName})`,
      caseConfig: sql<number>`MAX(${wmsStock.caseConfig})`,
      bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
      availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
      importPrice: sql<number | null>`${preferExact(
        wmsProductPricing.importPricePerBottle,
      )}`,
      logistics: sql<number | null>`${preferExact(
        wmsProductPricing.logisticsPerBottle,
      )}`,
      transfer: sql<number | null>`${preferExact(
        wmsProductPricing.transferPricePerBottle,
      )}`,
      override: sql<number | null>`${preferExact(
        wmsProductPricing.costOverridePerBottle,
      )}`,
      selling: sql<number | null>`${preferExact(
        wmsProductPricing.sellingPricePerBottle,
      )}`,
      inbondPct: sql<
        number | null
      >`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
      pcPct: sql<number | null>`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
    })
    .from(wmsStock)
    .leftJoin(
      wmsProductPricing,
      sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`,
    )
    .leftJoin(
      wmsOwnerPricingSettings,
      eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId),
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

  // Latest shipment product/landed cost, matched pack-agnostically (LWIN7 +
  // vintage + bottle size) so repacked SKUs inherit the base wine's cost.
  const pakStock = sql`split_part(${wmsStock.lwin18}, '-', 1) || '-' || split_part(${wmsStock.lwin18}, '-', 2) || '-' || split_part(${wmsStock.lwin18}, '-', 4)`;
  const pakItem = sql`split_part(${logisticsShipmentItems.lwin}, '-', 1) || '-' || split_part(${logisticsShipmentItems.lwin}, '-', 2) || '-' || split_part(${logisticsShipmentItems.lwin}, '-', 4)`;
  const shipRows = await db
    .select({
      lwin18: wmsStock.lwin18,
      productCost: logisticsShipmentItems.productCostPerBottle,
      landedCost: logisticsShipmentItems.landedCostPerBottle,
    })
    .from(wmsStock)
    .innerJoin(
      logisticsShipmentItems,
      and(
        isNotNull(logisticsShipmentItems.lwin),
        sql`${pakItem} = ${pakStock}`,
      ),
    )
    .where(inArray(wmsStock.lwin18, lwins))
    .orderBy(desc(logisticsShipmentItems.createdAt));
  const shipMap = new Map<
    string,
    { productCost: number | null; landedCost: number | null }
  >();
  for (const r of shipRows) {
    if (!shipMap.has(r.lwin18))
      shipMap.set(r.lwin18, {
        productCost: r.productCost,
        landedCost: r.landedCost,
      });
  }

  return rows.map((r) => {
    const ship = shipMap.get(r.lwin18);
    const manualImport =
      r.importPrice && r.importPrice > 0 ? r.importPrice : null;
    const importPaid = manualImport ?? ship?.productCost ?? 0;
    const systemLogistics =
      ship && ship.landedCost != null && ship.productCost != null
        ? Math.max(0, round2(ship.landedCost - ship.productCost))
        : 0;
    const logistics =
      r.logistics ??
      (systemLogistics > 0
        ? systemLogistics
        : isCraftCulture(r.owner) &&
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
      ibPerBottle: round2(ib),
      ibPerCase: round2(ib * cc),
      pcPerBottle: round2(pc),
      pcPerCase: round2(pc * cc),
    };
  });
};

export default getCatalogueRows;

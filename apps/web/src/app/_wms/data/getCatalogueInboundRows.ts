import { and, eq, gt, inArray, sql } from 'drizzle-orm';

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

export interface CatalogueInboundRow extends CatalogueRow {
  /** Earliest ETA across the shipments carrying this wine, if known */
  eta: Date | null;
}

export interface CatalogueInboundFilters {
  category?: string; // 'Wine' | 'Spirits' | 'RTD'
  search?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isCraftCulture = (owner: string | null) =>
  !!owner && /craft.*culture/i.test(owner);
const isZeroTransferOwner = (owner: string | null) =>
  !!owner && /(cru wine|crurated)/i.test(owner);

/** Shipment statuses that mean "bought, not yet received into wms_stock". */
const INBOUND_STATUSES = [
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
  'at_warehouse',
] as const;

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

/** HS-code buckets, mirroring the Pricing Manager's inbound categorisation. */
const CATEGORY_CASE = sql<string | null>`MAX(CASE
  WHEN ${logisticsShipmentItems.hsCode} IN ('22042100','22041000') THEN 'Wine'
  WHEN ${logisticsShipmentItems.hsCode} IN ('22084000','22083000','22082000','22089090','22085000','22087000','22086000') THEN 'Spirits'
  WHEN ${logisticsShipmentItems.hsCode} IN ('22030000','22060000') THEN 'RTD'
  ELSE NULL END)`;

/**
 * In-transit ("inbound") catalogue feed — stock bought and on its way to the
 * UAE bonded warehouse but not yet received into wms_stock.
 *
 * Priced with the same model as landed stock (Landed = import + logistics +
 * transfer + override, then ÷(1−InBond%) and ÷(1−PC%)) so an in-transit wine
 * quotes at the same number it will once it lands. Margin rates come from the
 * shipment's own partner — a shipment belongs to the partner whose stock it is
 * — falling back to the global defaults when a shipment has no partner.
 *
 * @param filters - Optional category / search narrowing
 * @returns One row per wine in transit, with its earliest ETA
 */
const getCatalogueInboundRows = async (
  filters: CatalogueInboundFilters = {},
): Promise<CatalogueInboundRow[]> => {
  const where = [
    eq(logisticsShipments.type, 'inbound'),
    gt(logisticsShipmentItems.cases, 0),
    // Same allowlist the Pricing Manager's inbound toggle uses. It deliberately
    // omits draft, partially_received, delivered and cancelled: once a shipment
    // starts being received its stock is in wms_stock, so including those here
    // would list the same bottles twice across the two feeds.
    inArray(logisticsShipments.status, [...INBOUND_STATUSES]),
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

  // One line per wine+pack+size (the Pricing Manager's grouping), so the same
  // wine arriving on two shipments collapses to one row with the earliest ETA.
  const groupKey = sql`COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName}) || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12') || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')`;

  const rows = await db
    .select({
      key: sql<string>`${groupKey}`,
      lwin: sql<string | null>`MAX(${logisticsShipmentItems.lwin})`,
      product: sql<string>`MAX(${logisticsShipmentItems.productName})`,
      producer: sql<string | null>`MAX(${logisticsShipmentItems.producer})`,
      caseConfig: sql<
        number | null
      >`MAX(${logisticsShipmentItems.bottlesPerCase})::int`,
      bottleSizeMl: sql<
        number | null
      >`MAX(${logisticsShipmentItems.bottleSizeMl})::int`,
      cases: sql<number>`SUM(${logisticsShipmentItems.cases})::int`,
      costPerBottle: sql<
        number | null
      >`MAX(${logisticsShipmentItems.productCostPerBottle})`,
      landedPerBottle: sql<
        number | null
      >`MAX(${logisticsShipmentItems.landedCostPerBottle})`,
      eta: sql<Date | null>`MIN(${logisticsShipments.eta})`,
      category: CATEGORY_CASE,
      owner: sql<string | null>`MAX(${partners.businessName})`,
      importPrice: sql<
        number | null
      >`MAX(${wmsProductPricing.importPricePerBottle})`,
      logistics: sql<
        number | null
      >`MAX(${wmsProductPricing.logisticsPerBottle})`,
      transfer: sql<
        number | null
      >`MAX(${wmsProductPricing.transferPricePerBottle})`,
      override: sql<
        number | null
      >`MAX(${wmsProductPricing.costOverridePerBottle})`,
      selling: sql<
        number | null
      >`MAX(${wmsProductPricing.sellingPricePerBottle})`,
      inbondPct: sql<
        number | null
      >`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
      pcPct: sql<number | null>`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
    })
    .from(logisticsShipmentItems)
    .innerJoin(
      logisticsShipments,
      eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
    )
    .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
    .leftJoin(
      wmsProductPricing,
      eq(wmsProductPricing.lwin18, logisticsShipmentItems.lwin),
    )
    .leftJoin(
      wmsOwnerPricingSettings,
      eq(wmsOwnerPricingSettings.ownerId, logisticsShipments.partnerId),
    )
    .where(and(...where))
    .groupBy(groupKey);

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
    const manualImport =
      r.importPrice && r.importPrice > 0 ? r.importPrice : null;
    const importPaid = manualImport ?? r.costPerBottle ?? 0;
    const systemLogistics =
      r.landedPerBottle != null && r.costPerBottle != null
        ? Math.max(0, round2(r.landedPerBottle - r.costPerBottle))
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
      availableBottles: r.cases * cc,
      ibPerBottle: round2(ib),
      ibPerCase: round2(ib * cc),
      pcPerBottle: round2(pc),
      pcPerCase: round2(pc * cc),
      eta: r.eta,
    };
  });
};

export default getCatalogueInboundRows;

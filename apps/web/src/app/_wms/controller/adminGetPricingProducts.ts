import { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  privateClientOrderItems,
  privateClientOrders,
  wmsOwnerPricing,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getPricingProductsSchema } from '../schemas/pricingManagerSchema';
import lwinPakKey from '../utils/lwinPakKey';

/**
 * Get products with stock and pricing data for the Pricing Manager page
 *
 * Returns paginated products with import/selling prices, plus summary stats
 * for KPI cards (total products, avg margin, unpriced count, total values).
 * Falls back to shipment landed cost when no explicit import price exists.
 */
/**
 * Standing air-freight estimate per bottle, used for in-transit wine until the
 * freight invoice is allocated against the shipment. Most C&C stock flies.
 */
const DEFAULT_AIR_FREIGHT_PER_BOTTLE = 20;

const adminGetPricingProducts = wmsOperatorProcedure
  .input(getPricingProductsSchema)
  .query(async ({ input }) => {
    const { search, category, ownerId, priceFilter, includeInbound, includeSoldOut, sortBy, sortOrder, limit, offset } =
      input;

    // Default hides sold-out SKUs (0 on hand); the "Sold (0 qty)" toggle relaxes
    // the qty>0 gate to >=0 (always true) so depleted lines show. KPI/summary
    // stay stock-on-hand only.
    const conditions = [
      includeSoldOut
        ? gte(sql`SUM(${wmsStock.quantityCases})`, 0)
        : gt(sql`SUM(${wmsStock.quantityCases})`, 0),
    ];
    const whereConditions = [
      includeSoldOut ? gte(wmsStock.quantityCases, 0) : gt(wmsStock.quantityCases, 0),
    ];

    // Price-gap filters operate on the grouped MAX() pricing values (HAVING)
    if (priceFilter === 'unpriced') {
      conditions.push(
        sql`MAX(${wmsProductPricing.importPricePerBottle}) > 0 AND COALESCE(MAX(${wmsProductPricing.sellingPricePerBottle}), 0) = 0`,
      );
    } else if (priceFilter === 'lossMaking') {
      // Below cost = EFFECTIVE PC (computed when owner has a PC%, else stored)
      // at/below landed cost — matches the Below-Cost KPI and the red rows.
      const landedH = sql`(MAX(${wmsProductPricing.importPricePerBottle}) + COALESCE(MAX(${wmsProductPricing.costOverridePerBottle}), 0) + COALESCE(MAX(${wmsProductPricing.transferPricePerBottle}), 2.5))`;
      const effH = sql`(CASE
        WHEN MAX(${wmsOwnerPricingSettings.pcMarginPct}) IS NOT NULL AND MAX(${wmsOwnerPricingSettings.pcMarginPct}) < 100
        THEN ${landedH} / (1 - COALESCE(MAX(${wmsOwnerPricingSettings.inbondMarginPct}), 0) / 100.0) / (1 - MAX(${wmsOwnerPricingSettings.pcMarginPct}) / 100.0)
        ELSE MAX(${wmsProductPricing.sellingPricePerBottle})
      END)`;
      conditions.push(sql`${effH} > 0 AND ${effH} <= ${landedH}`);
    } else if (priceFilter === 'noImport') {
      conditions.push(sql`COALESCE(MAX(${wmsProductPricing.importPricePerBottle}), 0) = 0`);
    }

    if (search) {
      whereConditions.push(
        or(
          ilike(wmsStock.productName, `%${search}%`),
          ilike(wmsStock.producer, `%${search}%`),
          ilike(wmsStock.lwin18, `%${search}%`),
        ),
      );
    }

    if (category) {
      if (category === 'Wine') {
        whereConditions.push(
          or(eq(wmsStock.category, 'Wine'), sql`${wmsStock.category} IS NULL`),
        );
      } else {
        whereConditions.push(eq(wmsStock.category, category));
      }
    }

    if (ownerId) {
      whereConditions.push(eq(wmsStock.ownerId, ownerId));
    }

    // Sort expression mapping
    const sortExpressions = {
      productName: sql`MAX(${wmsStock.productName})`,
      vintage: sql`MAX(${wmsStock.vintage})`,
      totalCases: sql`SUM(${wmsStock.quantityCases})`,
      importPrice: sql`MAX(${wmsProductPricing.importPricePerBottle})`,
      sellingPrice: sql`MAX(${wmsProductPricing.sellingPricePerBottle})`,
      margin: sql`CASE WHEN MAX(${wmsProductPricing.sellingPricePerBottle}) > 0 AND MAX(${wmsProductPricing.importPricePerBottle}) > 0 THEN (1 - MAX(${wmsProductPricing.importPricePerBottle}) / MAX(${wmsProductPricing.sellingPricePerBottle})) * 100 ELSE -999 END`,
    };

    const sortExpr = sortExpressions[sortBy];
    const orderFn = sortOrder === 'desc' ? desc : asc;

    const products = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        producer: sql<string | null>`MAX(${wmsStock.producer})`,
        vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
        caseConfig: sql<number | null>`MAX(${wmsStock.caseConfig})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        category: sql<string | null>`MAX(${wmsStock.category})`,
        // Owner(s) holding this SKU — drives the per-row owner badge in the
        // Pricing Manager. Usually one; ownerCount > 1 means the same lwin18 is
        // split across consignors (rare, but worth flagging visually).
        ownerNames: sql<string[]>`array_agg(DISTINCT ${wmsStock.ownerName})`,
        ownerCount: sql<number>`COUNT(DISTINCT ${wmsStock.ownerId})::int`,
        // 1 when Craft & Culture owns this stock — drives the $22.50 wine
        // logistics fallback for old C&C imports with no freight profile.
        isCraftCulture: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' THEN 1 ELSE 0 END)::int`,
        // 1 for consignment owners (Cru Wine / Crurated) — their transfer fee
        // default is $0 rather than the $2.50 FZ→mainland default.
        isZeroTransferOwner: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%cru wine%' OR ${wmsStock.ownerName} ILIKE '%crurated%' THEN 1 ELSE 0 END)::int`,
        importPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.importPricePerBottle})`,
        costOverridePerBottle: sql<number | null>`MAX(${wmsProductPricing.costOverridePerBottle})`,
        // Per-line logistics override ($/btl); null = fall back to owner/global
        lineLogistics: sql<number | null>`MAX(${wmsProductPricing.logisticsPerBottle})`,
        // Per-SKU FZ→mainland transfer fee ($/btl); null = the $2.50 default
        transferPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.transferPricePerBottle})`,
        sellingPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.sellingPricePerBottle})`,
        // Bespoke per-line margin % over landed (Spirits/RTD only)
        sellMarginPct: sql<number | null>`MAX(${wmsProductPricing.sellMarginPct})`,
        // Owner's own rates (explicit settings; null if the owner hasn't set them)
        ownerLogistics: sql<number | null>`MAX(${wmsOwnerPricingSettings.logisticsPerBottle})`,
        ownerInbondPct: sql<number | null>`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
        ownerPcPct: sql<number | null>`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`)
      .leftJoin(wmsOwnerPricingSettings, eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId))
      .where(and(...whereConditions))
      .groupBy(wmsStock.lwin18)
      .having(and(...conditions))
      .orderBy(orderFn(sortExpr))
      .limit(limit)
      .offset(offset);

    // Pull the latest shipment's product + landed cost for every row so we can
    // show the PAID import price (product cost) and the live system logistics
    // (freight = landed − product) as separate columns.
    const allLwin18s = products.map((p) => p.lwin18);
    const shipCostMap: Record<
      string,
      { productCost: number | null; landedCost: number | null }
    > = {};

    if (allLwin18s.length > 0) {
      // Match pack-agnostically (LWIN7 + vintage + bottle size, ignoring the pack
      // digits) so a repacked SKU (e.g. …-03-00750) inherits the base wine's
      // per-bottle cost from the original shipment line (…-12-00750).
      const pakStock = sql`split_part(${wmsStock.lwin18}, '-', 1) || '-' || split_part(${wmsStock.lwin18}, '-', 2) || '-' || split_part(${wmsStock.lwin18}, '-', 4)`;
      const pakItem = sql`split_part(${logisticsShipmentItems.lwin}, '-', 1) || '-' || split_part(${logisticsShipmentItems.lwin}, '-', 2) || '-' || split_part(${logisticsShipmentItems.lwin}, '-', 4)`;
      const shipmentRows = await db
        .select({
          lwin18: wmsStock.lwin18,
          productCostPerBottle: logisticsShipmentItems.productCostPerBottle,
          landedCostPerBottle: logisticsShipmentItems.landedCostPerBottle,
          createdAt: logisticsShipmentItems.createdAt,
        })
        .from(wmsStock)
        .innerJoin(
          logisticsShipmentItems,
          and(isNotNull(logisticsShipmentItems.lwin), sql`${pakItem} = ${pakStock}`),
        )
        .where(inArray(wmsStock.lwin18, allLwin18s))
        .orderBy(desc(logisticsShipmentItems.createdAt));

      for (const row of shipmentRows) {
        if (shipCostMap[row.lwin18] != null) continue;
        shipCostMap[row.lwin18] = {
          productCost: row.productCostPerBottle,
          landedCost: row.landedCostPerBottle,
        };
      }
    }

    // Break landed cost into its parts: import (paid goods, ex-freight) + system
    // logistics (live group freight) + transfer + override. A stored manual
    // import price wins over the shipment product cost.
    // Last sold price/btl — the most recent realized sale across Zoho
    // (dispatched/delivered/invoiced) and PCO (delivered/distributor_paid),
    // matched pack-agnostically (LWIN7+vintage+size). Rate/price is per ordered
    // pack → ÷ pack for per-bottle.
    const pak = (l: string) => {
      const s = l.split('-');
      return `${s[0] ?? ''}-${s[1] ?? ''}-${s[3] ?? ''}`;
    };
    const wantedKeys = new Set(products.map((p) => pak(p.lwin18)));
    const lastSoldMap: Record<
      string,
      { pricePerBottle: number; ref: string; soldAt: Date | null; tier: 'B2B' | 'PC' }
    > = {};
    const isNewer = (
      a: Date | null,
      b: { soldAt: Date | null } | undefined,
    ) => !b || (a != null && (b.soldAt == null || a > b.soldAt));

    const zohoSold = await db
      .select({
        sku: zohoSalesOrderItems.sku,
        rate: zohoSalesOrderItems.rate,
        description: zohoSalesOrderItems.description,
        ref: zohoSalesOrders.salesOrderNumber,
        soldAt: zohoSalesOrders.updatedAt,
      })
      .from(zohoSalesOrderItems)
      .innerJoin(zohoSalesOrders, eq(zohoSalesOrders.id, zohoSalesOrderItems.salesOrderId))
      .where(
        and(
          // Realized sale: shipped, OR billed in Zoho (zoho_status='invoiced')
          or(
            inArray(zohoSalesOrders.status, ['dispatched', 'delivered']),
            eq(zohoSalesOrders.zohoStatus, 'invoiced'),
          ),
          gt(zohoSalesOrderItems.rate, 0),
        ),
      )
      .orderBy(desc(zohoSalesOrders.updatedAt));

    for (const r of zohoSold) {
      if (!r.sku) continue;
      const key = pak(r.sku);
      if (!wantedKeys.has(key)) continue;
      const pack =
        Number(/^(\d+)/.exec(r.description ?? '')?.[1]) || Number(r.sku.split('-')[2]) || 1;
      if (isNewer(r.soldAt, lastSoldMap[key])) {
        lastSoldMap[key] = {
          pricePerBottle: Math.round((r.rate / pack) * 100) / 100,
          ref: r.ref,
          soldAt: r.soldAt,
          tier: 'B2B',
        };
      }
    }

    const pcoSold = await db
      .select({
        lwin: privateClientOrderItems.lwin,
        priceCase: privateClientOrderItems.pricePerCaseUsd,
        caseConfig: privateClientOrderItems.caseConfig,
        ref: privateClientOrders.orderNumber,
        soldAt: privateClientOrders.updatedAt,
      })
      .from(privateClientOrderItems)
      .innerJoin(privateClientOrders, eq(privateClientOrders.id, privateClientOrderItems.orderId))
      .where(
        and(
          inArray(privateClientOrders.status, ['delivered', 'distributor_paid']),
          gt(privateClientOrderItems.pricePerCaseUsd, 0),
        ),
      )
      .orderBy(desc(privateClientOrders.updatedAt));

    for (const r of pcoSold) {
      if (!r.lwin) continue;
      const key = pak(r.lwin);
      if (!wantedKeys.has(key)) continue;
      const pack = r.caseConfig && r.caseConfig > 0 ? r.caseConfig : 1;
      if (isNewer(r.soldAt, lastSoldMap[key])) {
        lastSoldMap[key] = {
          pricePerBottle: Math.round((r.priceCase / pack) * 100) / 100,
          ref: r.ref,
          soldAt: r.soldAt,
          tier: 'PC',
        };
      }
    }

    const enrichedProducts = products.map((p) => {
      const ship = shipCostMap[p.lwin18];
      const manualImport =
        p.importPricePerBottle != null && p.importPricePerBottle > 0
          ? p.importPricePerBottle
          : null;
      const importPaid = manualImport ?? ship?.productCost ?? null;
      const systemLogistics =
        ship && ship.landedCost != null && ship.productCost != null
          ? Math.max(0, Math.round((ship.landedCost - ship.productCost) * 100) / 100)
          : 0;
      return {
        ...p,
        // importPricePerBottle now carries the PAID goods cost (ex-freight)
        importPricePerBottle: importPaid,
        // live group/shipment freight per bottle (read-only; auto-updates)
        systemLogistics,
        // most recent realized sale (Zoho B2B or PCO), null if never sold
        lastSold: lastSoldMap[pak(p.lwin18)] ?? null,
      };
    });

    // Count total for pagination
    const countSubquery = db
      .select({
        lwin18: wmsStock.lwin18,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`)
      .leftJoin(wmsOwnerPricingSettings, eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId))
      .where(and(...whereConditions))
      .groupBy(wmsStock.lwin18)
      .having(and(...conditions))
      .as('counted');

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(countSubquery);

    const totalCount = countResult?.count ?? 0;

    // Summary stats — respect owner + category filter
    const summaryConditions = [gt(wmsStock.quantityCases, 0)];
    if (ownerId) {
      summaryConditions.push(eq(wmsStock.ownerId, ownerId));
    }
    if (category === 'Wine') {
      summaryConditions.push(
        or(eq(wmsStock.category, 'Wine'), sql`${wmsStock.category} IS NULL`)!,
      );
    } else if (category) {
      summaryConditions.push(eq(wmsStock.category, category));
    }

    // Per-owner landed cost and EFFECTIVE PC (what the table shows): when the
    // owner has a PC%, PC = landed/(1-inbond%)/(1-pc%) (always > landed, so not
    // "below cost"); otherwise the stored owner/default price. This keeps the
    // gap KPIs in step with the displayed rows instead of stale stored prices.
    // Import falls back to the latest shipment cost when no stored import price
    // (same as the displayed rows), so stock values aren't understated.
    // Landed = import (paid goods, ex-freight) + system logistics (live group
    // freight = shipment landed − product) + FZ→mainland transfer (default
    // $2.50) + manual override. Replaces the old flat owner logistics rate.
    const importPaidExpr = sql`COALESCE(NULLIF(${wmsProductPricing.importPricePerBottle}, 0), ship.product_cost, 0)`;
    const freightExpr = sql`GREATEST(COALESCE(ship.landed_cost, 0) - COALESCE(ship.product_cost, 0), 0)`;
    // Logistics = per-line override if set; else live freight; else $22.50
    // fallback for C&C-owned wine with no freight profile (old imports).
    // Non-C&C / non-wine with no freight = 0.
    // Logistics = per-line override; else live group freight; else the $22.50
    // fallback for C&C-owned wine with no freight profile (old imports).
    //
    // ZERO IS CORRECT for partner-owned stock: on those consignments the PARTNER
    // pays the freight, so C&C has no logistics cost to recover and landed is
    // import + transfer. Do not "fix" this by defaulting to the owner's
    // logistics rate — that inflates landed cost, and every price built on it,
    // on exactly the stock C&C ships for free.
    const logisticsExpr = sql`COALESCE(${wmsProductPricing.logisticsPerBottle}, (CASE WHEN ${freightExpr} > 0 THEN ${freightExpr} WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' AND (${wmsStock.category} = 'Wine' OR ${wmsStock.category} IS NULL) THEN 22.5 ELSE 0 END))`;
    const transferExpr = sql`COALESCE(${wmsProductPricing.transferPricePerBottle}, CASE WHEN ${wmsStock.ownerName} ILIKE '%cru wine%' OR ${wmsStock.ownerName} ILIKE '%crurated%' THEN 0 ELSE 2.5 END)`;
    const overrideExpr = sql`COALESCE(${wmsProductPricing.costOverridePerBottle}, 0)`;
    const landedExpr = sql`(CASE WHEN (${importPaidExpr} > 0 OR ${overrideExpr} <> 0) THEN ${importPaidExpr} + ${logisticsExpr} + ${transferExpr} + ${overrideExpr} ELSE 0 END)`;
    // The margin for each book, most specific source first: a per-line override,
    // then the band matching this wine's landed cost (the owner's own band
    // before the house one, and a narrower band before a wider one), then the
    // owner's flat rate, then 10%. Mirrors resolvePricingMargins, which holds
    // the same precedence in testable form.
    const bandPick = (column: 'b2b_margin_pct' | 'pc_margin_pct') => sql`(
      SELECT b.${sql.raw(column)} FROM wms_pricing_bands b
       WHERE (b.owner_id = ${wmsStock.ownerId} OR b.owner_id IS NULL)
         AND ${landedExpr} >= b.min_landed_per_bottle
         AND (b.max_landed_per_bottle IS NULL OR ${landedExpr} < b.max_landed_per_bottle)
         AND b.${sql.raw(column)} < 100
       ORDER BY (b.owner_id IS NULL),
                COALESCE(b.max_landed_per_bottle - b.min_landed_per_bottle, 1e9)
       LIMIT 1
    )`;

    const b2bMarginExpr = sql`COALESCE(
      NULLIF(${wmsProductPricing.b2bMarginPct}, 100),
      ${bandPick('b2b_margin_pct')},
      ${wmsOwnerPricingSettings.inbondMarginPct},
      10
    )`;
    const pcMarginExpr = sql`COALESCE(
      NULLIF(${wmsProductPricing.pcMarginPct}, 100),
      ${bandPick('pc_margin_pct')},
      ${wmsOwnerPricingSettings.pcMarginPct},
      10
    )`;

    // In-bond (B2B) price = landed / (1 - b2b%). C&C's profit = in-bond - landed.
    const inBondExpr = sql`(${landedExpr} / (1 - ${b2bMarginExpr} / 100.0))`;
    // PC = landed / (1 - pc%). A margin over LANDED in its own right: it no
    // longer compounds on top of the B2B price, so moving one book cannot
    // silently move the other. A hand-typed PC price still wins.
    const pcExpr = sql`(CASE
      WHEN COALESCE(${wmsOwnerPricing.pcSellingPricePerBottle}, 0) > 0
      THEN ${wmsOwnerPricing.pcSellingPricePerBottle}
      WHEN ${landedExpr} > 0 THEN ${landedExpr} / (1 - ${pcMarginExpr} / 100.0)
      ELSE COALESCE(${wmsProductPricing.sellingPricePerBottle}, 0)
    END)`;
    const bottlesExpr = sql`${wmsStock.quantityCases} * ${wmsStock.caseConfig}`;

    const [summaryResult] = await db
      .select({
        totalProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        totalImportValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.importPricePerBottle}), 0)::float`,
        pricedImportCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.importPricePerBottle} IS NOT NULL AND ${wmsProductPricing.importPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
        pricedSellingCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.sellingPricePerBottle} IS NOT NULL AND ${wmsProductPricing.sellingPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
        // Landed cost value of stock on hand (import/shipment + override + logistics)
        stockAtCost: sql<number>`COALESCE(SUM(${bottlesExpr} * ${landedExpr}), 0)::float`,
        // In-bond (B2B) value of stock
        inBondValue: sql<number>`COALESCE(SUM(CASE WHEN ${landedExpr} > 0 THEN ${bottlesExpr} * ${inBondExpr} END), 0)::float`,
        // Private-client value of stock (effective PC)
        pcValue: sql<number>`COALESCE(SUM(CASE WHEN ${pcExpr} > 0 THEN ${bottlesExpr} * ${pcExpr} END), 0)::float`,
        // C&C profit on stock = in-bond (B2B) price − landed cost
        potentialGrossProfit: sql<number>`COALESCE(SUM(CASE WHEN ${landedExpr} > 0 THEN ${bottlesExpr} * (${inBondExpr} - ${landedExpr}) END), 0)::float`,
        // SKUs priced at/below their landed cost
        belowCostCount: sql<number>`COUNT(DISTINCT CASE WHEN ${pcExpr} > 0 AND ${pcExpr} <= ${landedExpr} THEN ${wmsStock.lwin18} END)::int`,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`)
      .leftJoin(wmsOwnerPricingSettings, eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId))
      .leftJoin(
        wmsOwnerPricing,
        and(
          eq(wmsOwnerPricing.lwin18, wmsStock.lwin18),
          eq(wmsOwnerPricing.ownerId, wmsStock.ownerId),
        ),
      )
      .leftJoin(
        sql`(SELECT DISTINCT ON (split_part(lwin,'-',1)||'-'||split_part(lwin,'-',2)||'-'||split_part(lwin,'-',4)) split_part(lwin,'-',1)||'-'||split_part(lwin,'-',2)||'-'||split_part(lwin,'-',4) AS pak, product_cost_per_bottle AS product_cost, landed_cost_per_bottle AS landed_cost FROM logistics_shipment_items WHERE lwin IS NOT NULL ORDER BY split_part(lwin,'-',1)||'-'||split_part(lwin,'-',2)||'-'||split_part(lwin,'-',4), created_at DESC) ship`,
        sql`ship.pak = split_part(${wmsStock.lwin18},'-',1)||'-'||split_part(${wmsStock.lwin18},'-',2)||'-'||split_part(${wmsStock.lwin18},'-',4)`,
      )
      .where(and(...summaryConditions));

    // Blended margin = C&C's portfolio margin between in-bond and landed:
    // (in-bond value − landed value) / in-bond value. Value-weighted.
    const inBondValue = summaryResult?.inBondValue ?? 0;
    const stockAtCostVal = summaryResult?.stockAtCost ?? 0;
    const blendedMargin =
      inBondValue > 0 ? Math.round(((inBondValue - stockAtCostVal) / inBondValue) * 1000) / 10 : null;

    const unpricedCount =
      (summaryResult?.pricedImportCount ?? 0) - (summaryResult?.pricedSellingCount ?? 0);

    // In-transit (inbound shipment) products — returned separately so the
    // on-hand pagination is untouched. Cost comes from the shipment.
    const INBOUND_STATUSES = [
      'booked',
      'picked_up',
      'in_transit',
      'arrived_port',
      'customs_clearance',
      'cleared',
      'at_warehouse',
    ] as const;
    type InboundRow = {
      lwin18: string;
      productName: string;
      producer: string | null;
      vintage: number | null;
      caseConfig: number | null;
      bottleSize: string | null;
      totalCases: number;
      category: string | null;
      ownerNames: string[];
      ownerCount: number;
      importPricePerBottle: number | null;
      sellingPricePerBottle: number | null;
      costOverridePerBottle: number | null;
      lineLogistics: number | null;
      transferPricePerBottle: number | null;
      sellMarginPct: number | null;
      b2bMarginPct: number | null;
      pcMarginPct: number | null;
      pricingReleasedAt: Date | null;
      /** Per-line override, else allocated freight, else the air estimate. */
      systemLogistics: number;
      /** True while that figure is the estimate rather than a real invoice. */
      logisticsIsEstimate: boolean;
      earliestEta: Date | null;
      /** Which consignment this line arrived on — two can hold the same wine. */
      shipmentNumber: string | null;
      isInbound: true;
    };
    let inbound: InboundRow[] = [];

    if (includeInbound) {
      // Grouped by SHIPMENT as well as wine and pack. The same wine arriving on
      // two consignments has two different costs, and merging them showed one
      // line at MAX(cost) — so half the bottles were priced off the wrong cost
      // and the cheaper consignment's margin was invisible.
      const groupKey = sql`${logisticsShipmentItems.shipmentId}::text || '|' || COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName}) || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12') || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')`;
      const inboundConditions = [
        eq(logisticsShipments.type, 'inbound'),
        inArray(logisticsShipments.status, [...INBOUND_STATUSES]),
      ];
      if (search) {
        inboundConditions.push(
          or(
            ilike(logisticsShipmentItems.productName, `%${search}%`),
            ilike(logisticsShipmentItems.producer, `%${search}%`),
            ilike(logisticsShipmentItems.lwin, `%${search}%`),
          )!,
        );
      }
      if (category) {
        const hsCodes =
          category === 'Wine'
            ? ['22042100', '22041000']
            : category === 'Spirits'
              ? ['22084000', '22083000', '22082000', '22089090', '22085000', '22087000', '22086000']
              : ['22030000', '22060000'];
        inboundConditions.push(inArray(logisticsShipmentItems.hsCode, hsCodes));
      }

      const inboundRows = await db
        .select({
          lwin18: sql<string>`COALESCE(MAX(${logisticsShipmentItems.lwin}), MAX(${logisticsShipmentItems.productName}))`,
          productName: sql<string>`MAX(${logisticsShipmentItems.productName})`,
          producer: sql<string | null>`MAX(${logisticsShipmentItems.producer})`,
          caseConfig: sql<number | null>`MAX(${logisticsShipmentItems.bottlesPerCase})::int`,
          bottleSizeMl: sql<number | null>`MAX(${logisticsShipmentItems.bottleSizeMl})::int`,
          totalCases: sql<number>`SUM(${logisticsShipmentItems.cases})::int`,
          // A manually corrected import price wins over the shipment's own
          // figure — it was being ignored, so an edit saved and the row went on
          // showing the old cost.
          costPerBottle: sql<number | null>`COALESCE(NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0), MAX(${logisticsShipmentItems.productCostPerBottle}))`,
          sellingPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.sellingPricePerBottle})`,
          // Overrides ARE saved against in-transit wine — keyed by LWIN like any
          // other — but none of them were selected here, so the cell a user had
          // just edited came back empty and the edit looked lost.
          costOverridePerBottle: sql<number | null>`MAX(${wmsProductPricing.costOverridePerBottle})`,
          lineLogistics: sql<number | null>`MAX(${wmsProductPricing.logisticsPerBottle})`,
          transferPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.transferPricePerBottle})`,
          sellMarginPct: sql<number | null>`MAX(${wmsProductPricing.sellMarginPct})`,
          b2bMarginPct: sql<number | null>`MAX(${wmsProductPricing.b2bMarginPct})`,
          pcMarginPct: sql<number | null>`MAX(${wmsProductPricing.pcMarginPct})`,
          pricingReleasedAt: sql<Date | null>`MAX(${wmsProductPricing.pricingReleasedAt})`,
          // Freight actually allocated to the shipment line, per bottle. Zero
          // until the freight invoice is loaded against the consolidation group.
          allocatedFreight: sql<number | null>`MAX(GREATEST(COALESCE(${logisticsShipmentItems.landedCostPerBottle}, 0) - COALESCE(${logisticsShipmentItems.productCostPerBottle}, 0), 0))`,
          earliestEta: sql<Date | null>`MIN(${logisticsShipments.eta})`,
          shipmentNumber: sql<string | null>`MAX(${logisticsShipments.shipmentNumber})`,
          category: sql<string | null>`MAX(CASE WHEN ${logisticsShipmentItems.hsCode} IN ('22042100','22041000') THEN 'Wine' WHEN ${logisticsShipmentItems.hsCode} IN ('22084000','22083000','22082000','22089090','22085000','22087000','22086000') THEN 'Spirits' WHEN ${logisticsShipmentItems.hsCode} IN ('22030000','22060000') THEN 'RTD' ELSE NULL END)`,
        })
        .from(logisticsShipmentItems)
        .innerJoin(logisticsShipments, eq(logisticsShipmentItems.shipmentId, logisticsShipments.id))
        .leftJoin(wmsProductPricing, sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(logisticsShipmentItems.lwin)}`)
        .where(and(...inboundConditions))
        .groupBy(groupKey)
        .orderBy(asc(sql`MAX(${logisticsShipmentItems.productName})`))
        .limit(300);

      inbound = inboundRows.map((r) => ({
        lwin18: r.lwin18,
        productName: r.productName,
        producer: r.producer,
        // Derive vintage from a dashed LWIN (positions 8-11); null if the key
        // is a product-name fallback rather than a real LWIN.
        vintage: /^\d{7}-(\d{4})-/.test(r.lwin18)
          ? Number(r.lwin18.slice(8, 12))
          : null,
        caseConfig: r.caseConfig,
        bottleSize: r.bottleSizeMl != null ? `${r.bottleSizeMl / 10}cl` : null,
        totalCases: r.totalCases,
        category: r.category,
        // Inbound stock isn't owner-attributed yet (in transit) — no badge.
        ownerNames: [],
        ownerCount: 0,
        importPricePerBottle: r.costPerBottle,
        sellingPricePerBottle: r.sellingPricePerBottle,
        costOverridePerBottle: r.costOverridePerBottle,
        lineLogistics: r.lineLogistics,
        transferPricePerBottle: r.transferPricePerBottle,
        sellMarginPct: r.sellMarginPct,
        b2bMarginPct: r.b2bMarginPct,
        pcMarginPct: r.pcMarginPct,
        pricingReleasedAt: r.pricingReleasedAt,
        /*
          Logistics for in-transit wine: a per-line override, else the freight
          actually allocated to the shipment, else the standing air-freight
          estimate. Most stock flies, and until the freight invoice is loaded
          the alternative is showing $0.00 — which understates landed cost and
          is how a price barely above the buy price reached a price list.
          The estimate gives way to the actuals the moment they arrive.
        */
        systemLogistics:
          r.lineLogistics ??
          (r.allocatedFreight && r.allocatedFreight > 0
            ? r.allocatedFreight
            : DEFAULT_AIR_FREIGHT_PER_BOTTLE),
        logisticsIsEstimate:
          r.lineLogistics == null &&
          !(r.allocatedFreight && r.allocatedFreight > 0),
        earliestEta: r.earliestEta,
        shipmentNumber: r.shipmentNumber,
        isInbound: true as const,
      }));
    }

    return {
      inbound,
      products: enrichedProducts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + enrichedProducts.length < totalCount,
      },
      summary: {
        totalProducts: summaryResult?.totalProducts ?? 0,
        blendedMargin,
        unpricedCount: Math.max(0, unpricedCount),
        totalImportValue: Math.round((summaryResult?.totalImportValue ?? 0) * 100) / 100,
        stockAtCost: Math.round((summaryResult?.stockAtCost ?? 0) * 100) / 100,
        inBondValue: Math.round((summaryResult?.inBondValue ?? 0) * 100) / 100,
        pcValue: Math.round((summaryResult?.pcValue ?? 0) * 100) / 100,
        potentialGrossProfit: Math.round((summaryResult?.potentialGrossProfit ?? 0) * 100) / 100,
        belowCostCount: summaryResult?.belowCostCount ?? 0,
      },
    };
  });

export default adminGetPricingProducts;

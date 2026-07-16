import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsOwnerPricing,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getPricingProductsSchema } from '../schemas/pricingManagerSchema';

/**
 * Get products with stock and pricing data for the Pricing Manager page
 *
 * Returns paginated products with import/selling prices, plus summary stats
 * for KPI cards (total products, avg margin, unpriced count, total values).
 * Falls back to shipment landed cost when no explicit import price exists.
 */
const adminGetPricingProducts = wmsOperatorProcedure
  .input(getPricingProductsSchema)
  .query(async ({ input }) => {
    const { search, category, ownerId, priceFilter, includeInbound, sortBy, sortOrder, limit, offset } =
      input;

    const conditions = [gt(sql`SUM(${wmsStock.quantityCases})`, 0)];
    const whereConditions = [gt(wmsStock.quantityCases, 0)];

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
        // 1 when Craft & Culture owns this stock — drives the $22.50 wine
        // logistics fallback for old C&C imports with no freight profile.
        isCraftCulture: sql<number>`MAX(CASE WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' THEN 1 ELSE 0 END)::int`,
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
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
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
      };
    });

    // Count total for pagination
    const countSubquery = db
      .select({
        lwin18: wmsStock.lwin18,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
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
    // Logistics = live freight; else $22.50 fallback for C&C-owned wine that has
    // no freight profile (old imports). Non-C&C / non-wine with no freight = 0.
    const logisticsExpr = sql`(CASE WHEN ${freightExpr} > 0 THEN ${freightExpr} WHEN ${wmsStock.ownerName} ILIKE '%craft%culture%' AND (${wmsStock.category} = 'Wine' OR ${wmsStock.category} IS NULL) THEN 22.5 ELSE 0 END)`;
    const transferExpr = sql`COALESCE(${wmsProductPricing.transferPricePerBottle}, 2.5)`;
    const overrideExpr = sql`COALESCE(${wmsProductPricing.costOverridePerBottle}, 0)`;
    const landedExpr = sql`(CASE WHEN (${importPaidExpr} > 0 OR ${overrideExpr} <> 0) THEN ${importPaidExpr} + ${logisticsExpr} + ${transferExpr} + ${overrideExpr} ELSE 0 END)`;
    const pcExpr = sql`(CASE
      WHEN ${wmsOwnerPricingSettings.pcMarginPct} IS NOT NULL AND ${wmsOwnerPricingSettings.pcMarginPct} < 100
      THEN ${landedExpr} / (1 - COALESCE(${wmsOwnerPricingSettings.inbondMarginPct}, 0) / 100.0) / (1 - ${wmsOwnerPricingSettings.pcMarginPct} / 100.0)
      ELSE COALESCE(${wmsOwnerPricing.pcSellingPricePerBottle}, ${wmsProductPricing.sellingPricePerBottle})
    END)`;
    // In-bond (B2B) price = landed / (1 - inbond%). C&C's profit = in-bond - landed.
    const inBondExpr = sql`(${landedExpr} / (1 - COALESCE(${wmsOwnerPricingSettings.inbondMarginPct}, 0) / 100.0))`;
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
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
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
      importPricePerBottle: number | null;
      sellingPricePerBottle: number | null;
      earliestEta: Date | null;
      isInbound: true;
    };
    let inbound: InboundRow[] = [];

    if (includeInbound) {
      const groupKey = sql`COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName}) || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12') || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')`;
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
          costPerBottle: sql<number | null>`MAX(${logisticsShipmentItems.productCostPerBottle})`,
          sellingPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.sellingPricePerBottle})`,
          earliestEta: sql<Date | null>`MIN(${logisticsShipments.eta})`,
          category: sql<string | null>`MAX(CASE WHEN ${logisticsShipmentItems.hsCode} IN ('22042100','22041000') THEN 'Wine' WHEN ${logisticsShipmentItems.hsCode} IN ('22084000','22083000','22082000','22089090','22085000','22087000','22086000') THEN 'Spirits' WHEN ${logisticsShipmentItems.hsCode} IN ('22030000','22060000') THEN 'RTD' ELSE NULL END)`,
        })
        .from(logisticsShipmentItems)
        .innerJoin(logisticsShipments, eq(logisticsShipmentItems.shipmentId, logisticsShipments.id))
        .leftJoin(wmsProductPricing, eq(wmsProductPricing.lwin18, logisticsShipmentItems.lwin))
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
        importPricePerBottle: r.costPerBottle,
        sellingPricePerBottle: r.sellingPricePerBottle,
        earliestEta: r.earliestEta,
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

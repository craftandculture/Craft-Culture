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
      // Below cost = selling at/below landed cost (import + override)
      conditions.push(
        sql`MAX(${wmsProductPricing.sellingPricePerBottle}) > 0 AND MAX(${wmsProductPricing.sellingPricePerBottle}) <= MAX(${wmsProductPricing.importPricePerBottle}) + COALESCE(MAX(${wmsProductPricing.costOverridePerBottle}), 0)`,
      );
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
        importPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.importPricePerBottle})`,
        costOverridePerBottle: sql<number | null>`MAX(${wmsProductPricing.costOverridePerBottle})`,
        sellingPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.sellingPricePerBottle})`,
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

    // Fill missing import prices from shipment costs (same fallback as Stock Explorer)
    const missingLwin18s = products
      .filter((p) => p.importPricePerBottle == null || p.importPricePerBottle <= 0)
      .map((p) => p.lwin18);

    const shipmentPriceMap: Record<string, number> = {};

    if (missingLwin18s.length > 0) {
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
          and(
            eq(logisticsShipmentItems.shipmentId, wmsStock.shipmentId),
            eq(logisticsShipmentItems.lwin, wmsStock.lwin18),
          ),
        )
        .where(
          and(
            inArray(wmsStock.lwin18, missingLwin18s),
            isNotNull(wmsStock.shipmentId),
          ),
        )
        .orderBy(desc(logisticsShipmentItems.createdAt));

      for (const row of shipmentRows) {
        if (shipmentPriceMap[row.lwin18] != null) continue;
        const cost = row.landedCostPerBottle ?? row.productCostPerBottle;
        if (cost != null) {
          shipmentPriceMap[row.lwin18] = cost;
        }
      }
    }

    // Build final products with shipment cost fallback
    const enrichedProducts = products.map((p) => ({
      ...p,
      importPricePerBottle:
        p.importPricePerBottle != null && p.importPricePerBottle > 0
          ? p.importPricePerBottle
          : shipmentPriceMap[p.lwin18] ?? null,
    }));

    // Count total for pagination
    const countSubquery = db
      .select({
        lwin18: wmsStock.lwin18,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
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

    // Per-owner landed cost / stored PC (used for the value + gap KPIs)
    const landedExpr = sql`(COALESCE(${wmsProductPricing.importPricePerBottle}, 0) + COALESCE(${wmsProductPricing.costOverridePerBottle}, 0) + COALESCE(${wmsOwnerPricingSettings.logisticsPerBottle}, 25))`;
    const pcExpr = sql`COALESCE(${wmsOwnerPricing.pcSellingPricePerBottle}, ${wmsProductPricing.sellingPricePerBottle})`;
    const bottlesExpr = sql`${wmsStock.quantityCases} * ${wmsStock.caseConfig}`;

    const [summaryResult] = await db
      .select({
        totalProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        totalImportValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.importPricePerBottle}), 0)::float`,
        totalSellingValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.sellingPricePerBottle}), 0)::float`,
        pricedImportCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.importPricePerBottle} IS NOT NULL AND ${wmsProductPricing.importPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
        pricedSellingCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.sellingPricePerBottle} IS NOT NULL AND ${wmsProductPricing.sellingPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
        // Landed cost value of stock on hand (import + override + owner logistics)
        stockAtCost: sql<number>`COALESCE(SUM(${bottlesExpr} * ${landedExpr}), 0)::float`,
        // Potential gross profit if sold at stored PC (owner price, else default)
        potentialGrossProfit: sql<number>`COALESCE(SUM(CASE WHEN ${pcExpr} > 0 THEN ${bottlesExpr} * (${pcExpr} - ${landedExpr}) END), 0)::float`,
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
      .where(and(...summaryConditions));

    // Avg margin = value-weighted portfolio margin over the filtered stock:
    // (Σ sell·qty − Σ import·qty) / Σ sell·qty. This is robust — a single
    // mispriced SKU can't blow it up the way an average-of-ratios can — and it
    // respects the same category/owner/search filter as the totals above.
    const totalSell = summaryResult?.totalSellingValue ?? 0;
    const totalImport = summaryResult?.totalImportValue ?? 0;
    const avgMargin =
      totalSell > 0 ? Math.round(((totalSell - totalImport) / totalSell) * 1000) / 10 : null;

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
        avgMargin,
        unpricedCount: Math.max(0, unpricedCount),
        totalImportValue: Math.round((summaryResult?.totalImportValue ?? 0) * 100) / 100,
        totalSellingValue: Math.round((summaryResult?.totalSellingValue ?? 0) * 100) / 100,
        stockAtCost: Math.round((summaryResult?.stockAtCost ?? 0) * 100) / 100,
        potentialGrossProfit: Math.round((summaryResult?.potentialGrossProfit ?? 0) * 100) / 100,
        belowCostCount: summaryResult?.belowCostCount ?? 0,
      },
    };
  });

export default adminGetPricingProducts;

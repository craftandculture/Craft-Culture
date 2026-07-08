import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
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
      conditions.push(
        sql`MAX(${wmsProductPricing.sellingPricePerBottle}) > 0 AND MAX(${wmsProductPricing.sellingPricePerBottle}) <= MAX(${wmsProductPricing.importPricePerBottle})`,
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
        caseConfig: sql<number | null>`MAX(${wmsStock.caseConfig})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        category: sql<string | null>`MAX(${wmsStock.category})`,
        importPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.importPricePerBottle})`,
        costOverridePerBottle: sql<number | null>`MAX(${wmsProductPricing.costOverridePerBottle})`,
        sellingPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.sellingPricePerBottle})`,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
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

    // Summary stats — respect owner filter
    const summaryConditions = [gt(wmsStock.quantityCases, 0)];
    if (ownerId) {
      summaryConditions.push(eq(wmsStock.ownerId, ownerId));
    }

    const [summaryResult] = await db
      .select({
        totalProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        totalImportValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.importPricePerBottle}), 0)::float`,
        totalSellingValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.sellingPricePerBottle}), 0)::float`,
        pricedImportCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.importPricePerBottle} IS NOT NULL AND ${wmsProductPricing.importPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
        pricedSellingCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.sellingPricePerBottle} IS NOT NULL AND ${wmsProductPricing.sellingPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
      .where(and(...summaryConditions));

    // Calculate avg margin — respect owner filter
    const ownerSubquery = ownerId
      ? sql`(SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0 AND owner_id = ${ownerId}) s`
      : sql`(SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0) s`;

    const [marginResult] = await db
      .select({
        avgMargin: sql<number | null>`AVG(CASE WHEN p.selling_price_per_bottle > 0 AND p.import_price_per_bottle > 0 THEN (1 - p.import_price_per_bottle / p.selling_price_per_bottle) * 100 END)`,
      })
      .from(sql`wms_product_pricing p`)
      .innerJoin(ownerSubquery, sql`s.lwin18 = p.lwin18`);

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
        avgMargin: marginResult?.avgMargin != null ? Math.round(marginResult.avgMargin * 10) / 10 : null,
        unpricedCount: Math.max(0, unpricedCount),
        totalImportValue: Math.round((summaryResult?.totalImportValue ?? 0) * 100) / 100,
        totalSellingValue: Math.round((summaryResult?.totalSellingValue ?? 0) * 100) / 100,
      },
    };
  });

export default adminGetPricingProducts;

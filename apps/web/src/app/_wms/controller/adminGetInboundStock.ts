import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getInboundStockSchema } from '../schemas/stockQuerySchema';

/** Inbound shipment statuses (after booking, before WMS receiving) */
const INBOUND_STATUSES = [
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
  'at_warehouse',
] as const;

/**
 * Map HS code to product category.
 * Uses the same HS code mapping as the Zoho import UPC column.
 */
const HS_TO_CATEGORY = sql<string | null>`
  CASE
    WHEN ${logisticsShipmentItems.hsCode} IN ('22042100', '22041000') THEN 'Wine'
    WHEN ${logisticsShipmentItems.hsCode} IN ('22084000', '22083000', '22082000', '22089090', '22085000', '22087000', '22086000') THEN 'Spirits'
    WHEN ${logisticsShipmentItems.hsCode} IN ('22030000', '22060000') THEN 'RTD'
    ELSE NULL
  END
`;

/**
 * Grouping key for inbound items — same product across shipments should merge.
 * Uses LWIN when available, falls back to productName + pack config.
 */
const GROUP_KEY = sql<string>`
  COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName})
  || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12')
  || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')
`;

/**
 * Get inbound stock from active logistics shipments.
 * Shows items from shipments that are booked through at_warehouse
 * as virtual "inbound" rows in the Stock Explorer.
 */
const adminGetInboundStock = adminProcedure
  .input(getInboundStockSchema)
  .query(async ({ input }) => {
    const { search, category, sortBy, sortOrder, limit, offset } = input;

    // Base conditions: inbound shipments in active statuses
    const conditions = [
      eq(logisticsShipments.type, 'inbound'),
      inArray(logisticsShipments.status, [...INBOUND_STATUSES]),
    ];

    if (search) {
      conditions.push(
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
      conditions.push(inArray(logisticsShipmentItems.hsCode, hsCodes));
    }

    const whereClause = and(...conditions);

    // Main grouped query
    const baseQuery = db
      .select({
        groupKey: GROUP_KEY,
        productName: sql<string>`MAX(${logisticsShipmentItems.productName})`,
        producer: sql<string | null>`MAX(${logisticsShipmentItems.producer})`,
        lwin: sql<string | null>`MAX(${logisticsShipmentItems.lwin})`,
        vintage: sql<number | null>`MAX(${logisticsShipmentItems.vintage})`,
        bottleSizeMl: sql<number | null>`MAX(${logisticsShipmentItems.bottleSizeMl})`,
        bottlesPerCase: sql<number | null>`MAX(${logisticsShipmentItems.bottlesPerCase})`,
        expectedCases: sql<number>`SUM(${logisticsShipmentItems.cases})::int`,
        shipmentCount: sql<number>`COUNT(DISTINCT ${logisticsShipments.id})::int`,
        earliestEta: sql<Date | null>`MIN(${logisticsShipments.eta})`,
        latestEta: sql<Date | null>`MAX(${logisticsShipments.eta})`,
        category: HS_TO_CATEGORY,
      })
      .from(logisticsShipmentItems)
      .innerJoin(
        logisticsShipments,
        eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
      )
      .where(whereClause)
      .groupBy(GROUP_KEY);

    // Sort
    const sortExpr =
      sortBy === 'expectedCases'
        ? sql`SUM(${logisticsShipmentItems.cases})`
        : sortBy === 'productName'
          ? sql`MAX(${logisticsShipmentItems.productName})`
          : sortBy === 'vintage'
            ? sql`MAX(${logisticsShipmentItems.vintage})`
            : sql`MIN(${logisticsShipments.eta})`;

    const products = await baseQuery
      .orderBy(sortOrder === 'desc' ? desc(sortExpr) : asc(sortExpr))
      .limit(limit)
      .offset(offset);

    // Total count
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT (${GROUP_KEY}))::int`,
      })
      .from(logisticsShipmentItems)
      .innerJoin(
        logisticsShipments,
        eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
      )
      .where(whereClause);
    const totalCount = countResult?.count ?? 0;

    // Per-product shipment breakdown
    const productsWithShipments = await Promise.all(
      products.map(async (product) => {
        const shipments = await db
          .select({
            shipmentId: logisticsShipments.id,
            shipmentNumber: logisticsShipments.shipmentNumber,
            shipmentStatus: logisticsShipments.status,
            partnerName: partners.businessName,
            cases: logisticsShipmentItems.cases,
            eta: logisticsShipments.eta,
            ata: logisticsShipments.ata,
            originCountry: logisticsShipments.originCountry,
          })
          .from(logisticsShipmentItems)
          .innerJoin(
            logisticsShipments,
            eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
          )
          .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
          .where(
            and(
              whereClause,
              sql`${GROUP_KEY} = ${product.groupKey}`,
            ),
          )
          .orderBy(asc(logisticsShipments.eta));

        return {
          ...product,
          expectedBottles:
            product.expectedCases * (product.bottlesPerCase ?? 1),
          shipments,
        };
      }),
    );

    return {
      products: productsWithShipments,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + products.length < totalCount,
      },
    };
  });

export default adminGetInboundStock;

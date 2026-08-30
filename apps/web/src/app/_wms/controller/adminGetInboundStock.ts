import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  lwinWines,
  partners,
  wmsProductPricing,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getInboundStockSchema } from '../schemas/stockQuerySchema';
import INBOUND_SHIPMENT_STATUSES from '../utils/inboundShipmentStatuses';
import lwinPakKey from '../utils/lwinPakKey';


/** Inbound shipment statuses (after booking, before WMS receiving) */


/**
 * Map HS code to product category.
 * Uses the same HS code mapping as the Zoho import UPC column.
 */
const HS_TO_CATEGORY = sql<string | null>`MAX(
  CASE
    WHEN ${logisticsShipmentItems.hsCode} IN ('22042100', '22041000') THEN 'Wine'
    WHEN ${logisticsShipmentItems.hsCode} IN ('22084000', '22083000', '22082000', '22089090', '22085000', '22087000', '22086000') THEN 'Spirits'
    WHEN ${logisticsShipmentItems.hsCode} IN ('22030000', '22060000') THEN 'RTD'
    ELSE NULL
  END
)`;

/**
 * Canonical dashed LWIN — some suppliers (e.g. Cult Wines) store the LWIN as
 * 18 raw digits with no dashes, which otherwise fails to match the canonical
 * dashed records and duplicates the inbound row. Normalize in SQL so both
 * forms group and display as one.
 */
const NORMALIZED_LWIN = sql<string | null>`
  CASE
    WHEN ${logisticsShipmentItems.lwin} ~ '^[0-9]{18}$'
    THEN substr(${logisticsShipmentItems.lwin}, 1, 7) || '-'
      || substr(${logisticsShipmentItems.lwin}, 8, 4) || '-'
      || substr(${logisticsShipmentItems.lwin}, 12, 2) || '-'
      || substr(${logisticsShipmentItems.lwin}, 14, 5)
    ELSE ${logisticsShipmentItems.lwin}
  END
`;

/**
 * Grouping key for inbound items — same product across shipments should merge.
 * Uses the normalized LWIN when available, falls back to productName + pack config.
 */
const GROUP_KEY = sql<string>`
  COALESCE(${NORMALIZED_LWIN}, ${logisticsShipmentItems.productName})
  || '-' || COALESCE(${logisticsShipmentItems.bottlesPerCase}::text, '12')
  || 'x' || COALESCE(${logisticsShipmentItems.bottleSizeMl}::text, '750')
`;

/**
 * Get inbound stock from active logistics shipments.
 * Shows items from shipments that are booked through at_warehouse
 * as virtual "inbound" rows in the Stock Explorer.
 */
const adminGetInboundStock = wmsOperatorProcedure
  .input(getInboundStockSchema)
  .query(async ({ input }) => {
    const { search, category, sortBy, sortOrder, limit, offset } = input;

    // Base conditions: inbound shipments in active statuses
    const conditions = [
      eq(logisticsShipments.type, 'inbound'),
      inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
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
        /*
          A split line inherits the wine's identity rather than showing blank.

          Producer and cost were read from the shipment line alone. Splitting a
          six into singles mints a line with a new pack in its code and none of
          the wine's details on it, so a repacked bottle arrived with no
          producer, no cost and no value — the wine was known, just not on that
          row.

          Falls back to the LWIN reference, which is where a mapped line's
          identity comes from anyway.
        */
        producer: sql<string | null>`COALESCE(
          MAX(${logisticsShipmentItems.producer}),
          MAX(TRIM(COALESCE(${lwinWines.producerTitle}, '') || ' ' || COALESCE(${lwinWines.producerName}, '')))
        )`,
        lwin: sql<string | null>`MAX(${NORMALIZED_LWIN})`,
        vintage: sql<number | null>`MAX(${logisticsShipmentItems.vintage})`,
        bottleSizeMl: sql<number | null>`MAX(${logisticsShipmentItems.bottleSizeMl})`,
        bottlesPerCase: sql<number | null>`MAX(${logisticsShipmentItems.bottlesPerCase})`,
        expectedCases: sql<number>`SUM(${logisticsShipmentItems.cases})::int`,
        /*
          Cost is per BOTTLE, so a split pack keeps it and the case price simply
          follows the new pack — six singles out of a $600 case are $100 each,
          and the "case" price of a single is $100.

          Order: this line's own cost, then any other line of the same wine,
          vintage and bottle size regardless of pack (which is where the
          original case's cost still sits after a split), then the stored import
          price.
        */
        costPerBottle: sql<number | null>`COALESCE(
          MAX(${logisticsShipmentItems.productCostPerBottle}),
          MAX((
            SELECT sib.product_cost_per_bottle
              FROM logistics_shipment_items sib
             WHERE ${lwinPakKey(sql`sib.lwin`)} = ${lwinPakKey(logisticsShipmentItems.lwin)}
               AND sib.product_cost_per_bottle > 0
             ORDER BY sib.created_at DESC
             LIMIT 1
          )),
          MAX(${wmsProductPricing.importPricePerBottle})
        )`,
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
      // The wine's own record, for the identity a split line does not carry
      .leftJoin(
        lwinWines,
        sql`${lwinWines.lwin} = SUBSTRING(${logisticsShipmentItems.lwin} FROM 1 FOR 7)`,
      )
      // Prices are pack-agnostic, so a repack inherits what its case was priced at
      .leftJoin(
        wmsProductPricing,
        sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(logisticsShipmentItems.lwin)}`,
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

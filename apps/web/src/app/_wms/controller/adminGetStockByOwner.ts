import { and, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  wmsStock,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getStockByOwnerSchema } from '../schemas/stockQuerySchema';
import INBOUND_SHIPMENT_STATUSES from '../utils/inboundShipmentStatuses';

/**
 * Get stock grouped by owner with product breakdown
 * Shows all owners with their stock quantities and product counts
 *
 * @example
 *   await trpcClient.wms.admin.stock.getByOwner.query({});
 *   await trpcClient.wms.admin.stock.getByOwner.query({ ownerId: "uuid" });
 */
const adminGetStockByOwner = wmsOperatorProcedure
  .input(getStockByOwnerSchema)
  .query(async ({ input }) => {
    const { ownerId } = input;

    if (ownerId) {
      // Get detailed stock for specific owner
      const ownerStock = await db
        .select({
          lwin18: wmsStock.lwin18,
          productName: wmsStock.productName,
          producer: wmsStock.producer,
          vintage: wmsStock.vintage,
          bottleSize: wmsStock.bottleSize,
          caseConfig: wmsStock.caseConfig,
          totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
          availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
          reservedCases: sql<number>`SUM(${wmsStock.reservedCases})::int`,
          locationCount: sql<number>`COUNT(DISTINCT ${wmsStock.locationId})::int`,
          salesArrangement: wmsStock.salesArrangement,
          consignmentCommissionPercent: wmsStock.consignmentCommissionPercent,
        })
        .from(wmsStock)
        .where(and(eq(wmsStock.ownerId, ownerId), gt(wmsStock.quantityCases, 0)))
        .groupBy(
          wmsStock.lwin18,
          wmsStock.productName,
          wmsStock.producer,
          wmsStock.vintage,
          wmsStock.bottleSize,
          wmsStock.caseConfig,
          wmsStock.salesArrangement,
          wmsStock.consignmentCommissionPercent,
        )
        .orderBy(desc(sql`SUM(${wmsStock.quantityCases})`));

      // Get owner details
      const [owner] = await db
        .select({
          id: partners.id,
          name: partners.businessName,
          type: partners.type,
        })
        .from(partners)
        .where(eq(partners.id, ownerId));

      // Calculate totals
      const totalCases = ownerStock.reduce((sum, s) => sum + s.totalCases, 0);
      const totalAvailable = ownerStock.reduce((sum, s) => sum + s.availableCases, 0);
      const totalReserved = ownerStock.reduce((sum, s) => sum + s.reservedCases, 0);

      return {
        owner: owner ?? { id: ownerId, name: 'Unknown', type: null },
        summary: {
          totalCases,
          availableCases: totalAvailable,
          reservedCases: totalReserved,
          productCount: ownerStock.length,
        },
        products: ownerStock,
      };
    }

    // Get all owners with stock summary
    const owners = await db
      .select({
        ownerId: wmsStock.ownerId,
        // Canonical name from partners — the denormalised wmsStock.ownerName can
        // differ between rows of the same owner (mislabelled stock), which would
        // otherwise split one owner into duplicate dropdown rows sharing an ownerId.
        ownerName: sql<
          string | null
        >`COALESCE(MAX(${partners.businessName}), MAX(${wmsStock.ownerName}))`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
        reservedCases: sql<number>`SUM(${wmsStock.reservedCases})::int`,
        productCount: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        locationCount: sql<number>`COUNT(DISTINCT ${wmsStock.locationId})::int`,
        consignmentCount: sql<number>`COUNT(*) FILTER (WHERE ${wmsStock.salesArrangement} = 'consignment')::int`,
        purchasedCount: sql<number>`COUNT(*) FILTER (WHERE ${wmsStock.salesArrangement} = 'purchased')::int`,
      })
      .from(wmsStock)
      .leftJoin(partners, eq(partners.id, wmsStock.ownerId))
      .where(gt(wmsStock.quantityCases, 0))
      .groupBy(wmsStock.ownerId)
      .orderBy(desc(sql`SUM(${wmsStock.quantityCases})`));

    /*
      Partners whose wine is still in transit own no warehouse stock yet, so
      they were absent from this list — and the owner filter is built from it.
      That made it impossible to filter to a new partner's consignment on any
      screen until their first case was received.
    */
    const inboundOwners = await db
      .select({
        ownerId: logisticsShipments.partnerId,
        ownerName: sql<string>`MAX(${partners.businessName})`,
        inboundCases: sql<number>`SUM(${logisticsShipmentItems.cases})::int`,
      })
      .from(logisticsShipmentItems)
      .innerJoin(
        logisticsShipments,
        eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
      )
      .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
      .where(
        and(
          eq(logisticsShipments.type, 'inbound'),
          isNotNull(logisticsShipments.partnerId),
          /*
            Only what is actually on its way.

            This had no status filter, so it counted every inbound line ever
            raised against a partner — drafts never bought, shipments long
            since delivered into stock, and cancellations. A partner with 65
            wines in transit was offered in the filter as "76 inbound", and the
            same owner appeared twice where an old shipment sat under a second
            partner record.
          */
          inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
          // Bottles, not cases: a line billed loose carries no case of its own
          gt(logisticsShipmentItems.totalBottles, 0),
        ),
      )
      .groupBy(logisticsShipments.partnerId);

    const known = new Set(owners.map((o) => o.ownerId));
    for (const inbound of inboundOwners) {
      if (!inbound.ownerId || known.has(inbound.ownerId)) continue;
      owners.push({
        ownerId: inbound.ownerId,
        ownerName: inbound.ownerName,
        totalCases: 0,
        availableCases: 0,
        reservedCases: 0,
        productCount: 0,
        locationCount: 0,
        consignmentCount: 0,
        purchasedCount: 0,
        // Nothing landed yet — shown so the partner can be filtered to.
        inboundCases: inbound.inboundCases,
      } as (typeof owners)[number]);
    }

    // Calculate grand totals
    const grandTotals = {
      totalCases: owners.reduce((sum, o) => sum + o.totalCases, 0),
      availableCases: owners.reduce((sum, o) => sum + o.availableCases, 0),
      reservedCases: owners.reduce((sum, o) => sum + o.reservedCases, 0),
      ownerCount: owners.length,
    };

    return {
      owners,
      grandTotals,
    };
  });

export default adminGetStockByOwner;

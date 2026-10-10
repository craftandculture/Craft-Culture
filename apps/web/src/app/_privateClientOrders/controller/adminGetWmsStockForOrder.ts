import { and, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsStock,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import INBOUND_SHIPMENT_STATUSES from '../../_wms/utils/inboundShipmentStatuses';
import normalizeLwin18 from '../../_wms/utils/normalizeLwin18';

const inputSchema = z.object({
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

/**
 * Get WMS stock for order entry (admin use).
 *
 * When `ownerId` is provided, scopes to that partner's warehouse stock
 * (used when an admin builds an order on behalf of a partner). When
 * `ownerId` is omitted, returns all warehouse stock across every owner,
 * aggregated by LWIN — so C&C can sell anything held in the warehouse.
 *
 * In-transit wine is offered alongside it. A client adding a wine to their
 * order does not care whether it has landed yet, and this list only held
 * landed stock — so anything still on the water could not be picked and was
 * typed in by hand instead. A hand-typed line carries no LWIN, and without one
 * the order cannot raise a Zoho sales order at all. Better to offer the wine
 * with its code and let the order wait for the shipment.
 */
const adminGetWmsStockForOrder = wmsOperatorProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { ownerId, search, limit, offset } = input;

    /*
      Every word must match somewhere — name, producer, code or vintage — rather
      than the whole phrase in one column. "Fourrier Gevrey" never matched when
      the producer and the wine name sat in different columns, which is how
      Domaine Fourrier could not be found for PCO 79. A code typed without its
      dashes is put back into the stored shape.
    */
    const words = (search ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (/^\d{18}$/.test(w) ? normalizeLwin18(w) : w))
      .slice(0, 8);
    const like = (w: string) => `%${w.replace(/[^\x20-\x7E]/g, '%')}%`;

    const searchConditions = words.length
      ? and(
          ...words.map((w) =>
            or(
              ilike(wmsStock.productName, like(w)),
              ilike(wmsStock.producer, like(w)),
              ilike(wmsStock.lwin18, like(w)),
              ilike(sql`${wmsStock.vintage}::text`, like(w)),
            ),
          ),
        )
      : undefined;

    const rows = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MIN(${wmsStock.productName})`.as('product_name'),
        producer: sql<string | null>`MIN(${wmsStock.producer})`.as('producer'),
        vintage: sql<number | null>`MIN(${wmsStock.vintage})`.as('vintage'),
        bottleSize: sql<string>`MIN(${wmsStock.bottleSize})`.as('bottle_size'),
        caseConfig: wmsStock.caseConfig,
        availableCases: sql<number>`SUM(${wmsStock.availableCases})`.as('available_cases'),
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})`.as('total_cases'),
      })
      .from(wmsStock)
      .where(
        and(
          ownerId ? eq(wmsStock.ownerId, ownerId) : undefined,
          searchConditions,
        ),
      )
      .groupBy(wmsStock.lwin18, wmsStock.caseConfig)
      /*
        Anything physically here, even if every case is held for an order. It
        used to list only wine with free cases, so held wine simply vanished
        and looked like it had never arrived; it now shows with 0 available,
        and the order line says who holds it.
      */
      .having(gt(sql`SUM(${wmsStock.quantityCases}) + SUM(${wmsStock.openBottles})`, 0))
      .orderBy(sql`MIN(${wmsStock.productName})`)
      .limit(limit)
      .offset(offset);

    /*
      In-transit lines, from the shipments the wine is travelling on. Counted in
      bottles because that is what a shipment line records; cases are derived so
      the shape matches landed stock and the picker needs no special case.
    */
    const inboundRows = await db
      .select({
        lwin18: sql<string>`${logisticsShipmentItems.lwin}`,
        productName: sql<string>`MIN(${logisticsShipmentItems.productName})`.as(
          'product_name',
        ),
        producer: sql<string | null>`MIN(${logisticsShipmentItems.producer})`.as(
          'producer',
        ),
        vintage: sql<number | null>`MIN(${logisticsShipmentItems.vintage})`.as(
          'vintage',
        ),
        bottlesPerCase: sql<number | null>`MAX(${logisticsShipmentItems.bottlesPerCase})`.as(
          'bottles_per_case',
        ),
        bottleSizeMl: sql<number | null>`MAX(${logisticsShipmentItems.bottleSizeMl})`.as(
          'bottle_size_ml',
        ),
        bottles: sql<number>`SUM(
          COALESCE(
            NULLIF(${logisticsShipmentItems.totalBottles}, 0),
            COALESCE(${logisticsShipmentItems.cases}, 0)
              * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
          )
        )::int`.as('bottles'),
      })
      .from(logisticsShipmentItems)
      .innerJoin(
        logisticsShipments,
        eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
      )
      .where(
        and(
          eq(logisticsShipments.type, 'inbound'),
          inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
          ownerId ? eq(logisticsShipments.partnerId, ownerId) : undefined,
          sql`COALESCE(${logisticsShipmentItems.lwin}, '') <> ''`,
          ...words.map((w) =>
            or(
              ilike(logisticsShipmentItems.productName, like(w)),
              ilike(logisticsShipmentItems.producer, like(w)),
              ilike(logisticsShipmentItems.lwin, like(w)),
              ilike(sql`${logisticsShipmentItems.vintage}::text`, like(w)),
            ),
          ),
        ),
      )
      .groupBy(logisticsShipmentItems.lwin)
      .limit(limit);

    // A wine already on the shelf is the better answer, so landed wins and the
    // in-transit copy is dropped rather than offered twice.
    const landedLwins = new Set(rows.map((r) => r.lwin18));
    const inbound = inboundRows
      .filter((r) => r.lwin18 && !landedLwins.has(r.lwin18))
      .map((r) => {
        const pack = r.bottlesPerCase && r.bottlesPerCase > 0 ? r.bottlesPerCase : 12;
        return {
          lwin18: r.lwin18,
          productName: r.productName,
          producer: r.producer,
          vintage: r.vintage,
          bottleSize: r.bottleSizeMl ? `${r.bottleSizeMl}ml` : '750ml',
          caseConfig: pack,
          availableCases: Math.floor((r.bottles ?? 0) / pack),
          totalCases: Math.floor((r.bottles ?? 0) / pack),
          isInTransit: true as const,
        };
      })
      .filter((r) => r.availableCases > 0);

    return {
      data: [...rows.map((r) => ({ ...r, isInTransit: false as const })), ...inbound],
      meta: {
        offset,
        limit,
        hasMore: rows.length === limit,
      },
    };
  });

export default adminGetWmsStockForOrder;

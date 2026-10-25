import { and, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import getOwnerDeliveryOwners from '@/app/_cellar/data/getOwnerDeliveryOwners';
import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';
import getCollectorStockHolds from '@/app/_wms/data/getCollectorStockHolds';
import db from '@/database/client';
import {
  partners,
  privateClientOrders,
  wmsLocations,
  wmsStockMovements,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const packOf = (lwin18: string) => {
  const pack = Number(lwin18.split('-')[2]);

  return Number.isFinite(pack) && pack > 0 ? pack : 1;
};

/**
 * Every bottle that left the warehouse in a period, by owner (staff only)
 *
 * The check behind the member statement's "Left your cellar": picks, take-outs
 * and count shortfalls, each with the order and customer it went to. Wine held
 * for its owner (not for sale, and not since offered) that went out on a trade
 * sales order is flagged — wine leaving that the owner never offered.
 * Outflows no owner could be worked out for are counted separately, for an
 * operator to attribute.
 *
 * @example
 *   await trpcClient.wms.admin.stock.getOwnerOutflows.query({
 *     from: '2026-10-01',
 *     to: '2026-11-01',
 *   });
 */
const adminGetOwnerOutflows = adminProcedure
  .input(
    z.object({
      from: z.coerce.date(),
      to: z.coerce.date(),
      ownerId: z.string().uuid().optional(),
    }),
  )
  .query(async ({ input }) => {
    const isOutflow = or(
      eq(wmsStockMovements.movementType, 'pick'),
      and(
        eq(wmsStockMovements.movementType, 'adjust'),
        sql`${wmsStockMovements.reasonCode} LIKE 'stock_out:%'`,
      ),
      and(
        eq(wmsStockMovements.movementType, 'count'),
        lt(wmsStockMovements.quantityCases, 0),
      ),
    );
    const inPeriod = and(
      gte(wmsStockMovements.performedAt, input.from),
      lt(wmsStockMovements.performedAt, input.to),
    );

    const [rows, unattributed] = await Promise.all([
      db
        .select({
          id: wmsStockMovements.id,
          at: wmsStockMovements.performedAt,
          movementType: wmsStockMovements.movementType,
          reasonCode: wmsStockMovements.reasonCode,
          lwin18: wmsStockMovements.lwin18,
          productName: wmsStockMovements.productName,
          quantityCases: wmsStockMovements.quantityCases,
          quantityBottles: wmsStockMovements.quantityBottles,
          ownerInferred: wmsStockMovements.ownerInferred,
          // The bay's row for this owner and wine, emptied rows included
          notForSale: sql<boolean>`(
            SELECT bool_or(s.not_for_sale) FROM wms_stock s
            WHERE s.owner_id = ${wmsStockMovements.fromOwnerId}
              AND s.lwin18 = ${wmsStockMovements.lwin18}
              AND s.location_id = ${wmsStockMovements.fromLocationId}
          )`,
          ownerId: partners.id,
          ownerName: partners.businessName,
          ownerType: partners.type,
          bay: wmsLocations.locationCode,
          salesOrderNumber: zohoSalesOrders.salesOrderNumber,
          customerName: zohoSalesOrders.customerName,
          pcoNumber: privateClientOrders.orderNumber,
          orderKind: privateClientOrders.orderKind,
          orderId: wmsStockMovements.orderId,
        })
        .from(wmsStockMovements)
        .innerJoin(partners, eq(wmsStockMovements.fromOwnerId, partners.id))
        .leftJoin(
          wmsLocations,
          eq(wmsStockMovements.fromLocationId, wmsLocations.id),
        )
        .leftJoin(
          zohoSalesOrders,
          eq(wmsStockMovements.orderId, zohoSalesOrders.id),
        )
        .leftJoin(
          privateClientOrders,
          eq(wmsStockMovements.orderId, privateClientOrders.id),
        )
        .where(
          and(
            inPeriod,
            isOutflow,
            input.ownerId
              ? eq(wmsStockMovements.fromOwnerId, input.ownerId)
              : undefined,
          ),
        )
        .orderBy(partners.businessName, wmsStockMovements.performedAt),
      db
        .select({
          movements: sql<number>`count(*)::int`,
          bottles: sql<number>`coalesce(sum(abs(${wmsStockMovements.quantityBottles})), 0)::int`,
        })
        .from(wmsStockMovements)
        .where(
          and(inPeriod, isOutflow, isNull(wmsStockMovements.fromOwnerId)),
        ),
    ]);

    const holds = await getCollectorStockHolds(rows);
    const ownDeliveries = await getOwnerDeliveryOwners(rows.map((row) => row.orderId));

    const lines = rows.map((row) => {
      const bottles = Math.abs(
        row.quantityBottles ?? row.quantityCases * packOf(row.lwin18),
      );
      const stockOut = row.reasonCode?.startsWith('stock_out:')
        ? (row.reasonCode.slice(
            'stock_out:'.length,
          ) as keyof typeof STOCK_OUT_REASONS)
        : null;
      const delivery = row.orderId ? ownDeliveries.get(row.orderId) : undefined;
      const ownDelivery = delivery?.ownerId === row.ownerId;
      const unoffered =
        row.movementType === 'pick' &&
        !!row.salesOrderNumber &&
        !ownDelivery &&
        holds.isHeld(row);

      return {
        id: row.id,
        at: row.at,
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        ownerType: row.ownerType,
        ownerInferred: row.ownerInferred,
        wine: row.productName,
        lwin18: row.lwin18,
        bay: row.bay,
        bottles,
        how: stockOut
          ? (STOCK_OUT_REASONS[stockOut]?.label ?? 'Taken out of stock')
          : row.movementType === 'count'
            ? 'Stock count shortfall'
            : ownDelivery
              ? `Owner's own delivery · ${delivery?.pcoNumber}`
              : 'Picked for an order',
        order: row.salesOrderNumber ?? row.pcoNumber,
        orderKind: row.orderKind,
        customer: row.customerName,
        flag: unoffered
          ? 'Held for its owner (not for sale) but picked for a trade order'
          : null,
      };
    });

    const owners = new Map<
      string,
      {
        ownerId: string;
        ownerName: string;
        ownerType: string;
        bottles: number;
        flaggedBottles: number;
        inferredBottles: number;
      }
    >();
    for (const line of lines) {
      const owner = owners.get(line.ownerId) ?? {
        ownerId: line.ownerId,
        ownerName: line.ownerName,
        ownerType: line.ownerType,
        bottles: 0,
        flaggedBottles: 0,
        inferredBottles: 0,
      };
      owner.bottles += line.bottles;
      if (line.flag) owner.flaggedBottles += line.bottles;
      if (line.ownerInferred) owner.inferredBottles += line.bottles;
      owners.set(line.ownerId, owner);
    }

    return {
      owners: [...owners.values()].sort((a, b) => b.bottles - a.bottles),
      lines,
      unattributed: unattributed[0] ?? { movements: 0, bottles: 0 },
    };
  });

export default adminGetOwnerOutflows;

import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  privateClientOrders,
  wmsStock,
  wmsStockReservations,
  zohoSalesOrders,
} from '@/database/schema';

import wineFromLwin from '../utils/wineFromLwin';

export type ReservationStatusFilter = 'active' | 'picked' | 'released' | 'all';

export interface PartnerReservationQuery {
  status: ReservationStatusFilter;
  /** Only holds created or changed at or after this moment */
  updatedSince?: Date;
  limit: number;
  offset: number;
}

/**
 * Stock of the partner's that is held for an order
 *
 * A hold is theirs when it was recorded against them (`owner_id`, set on every
 * hold since owners were stamped) or, for older holds, when the stock row it
 * binds to is theirs. Buyers are never named: the order is a reference and a
 * kind (distributor or private client), as everywhere else in the partner API.
 *
 * @example
 *   const page = await getPartnerReservations(partnerId, { status: 'active', limit: 100, offset: 0 });
 *
 * @param partnerId - The key holder
 * @param query - Status filter, change window and page
 * @returns Holds, newest first
 */
const getPartnerReservations = async (partnerId: string, query: PartnerReservationQuery) => {
  const theirs = or(
    eq(wmsStockReservations.ownerId, partnerId),
    and(
      isNull(wmsStockReservations.ownerId),
      inArray(
        wmsStockReservations.stockId,
        db.select({ id: wmsStock.id }).from(wmsStock).where(eq(wmsStock.ownerId, partnerId)),
      ),
    ),
  );

  const rows = await db
    .select({
      id: wmsStockReservations.id,
      status: wmsStockReservations.status,
      orderType: wmsStockReservations.orderType,
      lwin18: wmsStockReservations.lwin18,
      productName: wmsStockReservations.productName,
      quantityCases: wmsStockReservations.quantityCases,
      quantityBottles: wmsStockReservations.quantityBottles,
      createdAt: wmsStockReservations.createdAt,
      updatedAt: wmsStockReservations.updatedAt,
      pickedAt: wmsStockReservations.pickedAt,
      releasedAt: wmsStockReservations.releasedAt,
      pcoNumber: privateClientOrders.orderNumber,
      pcoPartnerId: privateClientOrders.partnerId,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
      soForPco: sql<string | null>`COALESCE(${zohoSalesOrders.privateClientOrderId}::text, substring(${zohoSalesOrders.referenceNumber} from 'PCO-[0-9]{4}-[0-9]+'))`,
    })
    .from(wmsStockReservations)
    .leftJoin(privateClientOrders, eq(wmsStockReservations.orderId, privateClientOrders.id))
    .leftJoin(zohoSalesOrders, eq(wmsStockReservations.orderId, zohoSalesOrders.id))
    .where(
      and(
        theirs,
        query.status === 'all' ? undefined : eq(wmsStockReservations.status, query.status),
        query.updatedSince ? gte(wmsStockReservations.updatedAt, query.updatedSince) : undefined,
      ),
    )
    .orderBy(desc(wmsStockReservations.createdAt), desc(wmsStockReservations.id))
    .limit(query.limit + 1)
    .offset(query.offset);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  const data = page.map((row) => {
    const wine = wineFromLwin(row.lwin18, row.productName);
    const isPrivateClient = Boolean(row.pcoNumber || row.soForPco);

    return {
      id: row.id,
      status: row.status,
      wine,
      cases: row.quantityCases,
      bottles: row.quantityBottles ?? row.quantityCases * (wine.caseSize ?? 1),
      order: {
        reference:
          row.pcoNumber && row.pcoPartnerId === partnerId
            ? row.pcoNumber
            : row.pcoNumber
              ? null
              : (row.salesOrderNumber ?? null),
        channel: isPrivateClient
          ? ('private_client' as const)
          : row.orderType === 'zoho' || row.orderType === 'zoho_draft'
            ? ('distributor' as const)
            : null,
        isDraft: row.orderType === 'zoho_draft',
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      pickedAt: row.pickedAt?.toISOString() ?? null,
      releasedAt: row.releasedAt?.toISOString() ?? null,
    };
  });

  return {
    data,
    meta: { hasMore, nextOffset: hasMore ? query.offset + query.limit : null },
  };
};

export default getPartnerReservations;

import { and, asc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import getOwnerDeliveryOwners from '@/app/_cellar/data/getOwnerDeliveryOwners';
import getCraftCultureOwnerIds from '@/app/_partners/data/getCraftCultureOwnerIds';
import partnerMovementScope from '@/app/_wms/utils/partnerMovementScope';
import db from '@/database/client';
import {
  privateClientOrders,
  wmsStockMovements,
  zohoSalesOrders,
} from '@/database/schema';

import classifyPartnerMovement from '../utils/classifyPartnerMovement';
import movementCursor from '../utils/movementCursor';
import wineFromLwin from '../utils/wineFromLwin';

/**
 * Movement types a partner is shown. Pallet handling is how the warehouse
 * organises itself, not something that happened to the wine.
 */
const PARTNER_MOVEMENT_TYPES = [
  'receive',
  'putaway',
  'transfer',
  'pick',
  'repack_in',
  'repack_out',
  'adjust',
  'count',
  'dispatch',
  'ownership_transfer',
] as const;

/** The only types that can be a sale: a pick, a transfer to C&C, a take-out (or a return of one) */
const SALE_CANDIDATE_TYPES = ['pick', 'ownership_transfer', 'adjust'] as const;

/**
 * The PCO a Zoho sales order was raised to fulfil. Picks against that SO carry
 * the SO's id, not the PCO's, so without this a partner's own PCO showed our
 * SO number and could not be told from our own sales.
 */
const pcoViaSalesOrder = alias(privateClientOrders, 'pco_via_so');

export interface PartnerMovementQuery {
  /** Opaque cursor from the previous page's `nextCursor` */
  cursor?: string;
  /** Only events at or after this moment (ignored when a cursor is given) */
  since?: Date;
  /** Only events before this moment */
  until?: Date;
  /** Narrow to one wine */
  lwin18?: string;
  /** Only events that are sales */
  salesOnly?: boolean;
  limit: number;
}

/**
 * A partner's stock events, oldest first, for an integration to sync from
 *
 * Scoped by the same rule as the partner portal's stock ledger
 * (`partnerMovementScope`), so the API cannot show a partner anything the
 * portal would not. Paged by an opaque cursor on (performed_at, id): an
 * integration stores `nextCursor` and asks again later to receive only what
 * has happened since, in order, with nothing skipped or repeated.
 *
 * With `salesOnly`, non-sales are dropped after classification, so a page can
 * hold fewer rows than `limit`. Keep paging until `hasMore` is false.
 *
 * @example
 *   const page = await getPartnerMovementEvents(partnerId, { limit: 200 });
 *   const next = await getPartnerMovementEvents(partnerId, { cursor: page.meta.nextCursor!, limit: 200 });
 *
 * @param partnerId - The key holder
 * @param query - Cursor, window, wine filter and page size
 * @returns Events and paging metadata
 */
const getPartnerMovementEvents = async (partnerId: string, query: PartnerMovementQuery) => {
  const scope = await partnerMovementScope(partnerId);
  const decoded = query.cursor ? movementCursor.decode(query.cursor) : null;

  if (scope.ownedLwins.length === 0) {
    return {
      data: [],
      meta: { nextCursor: query.cursor ?? null, hasMore: false, sharedWineCount: 0 },
    };
  }

  const rows = await db
    .select({
      id: wmsStockMovements.id,
      movementNumber: wmsStockMovements.movementNumber,
      movementType: wmsStockMovements.movementType,
      reasonCode: wmsStockMovements.reasonCode,
      lwin18: wmsStockMovements.lwin18,
      productName: wmsStockMovements.productName,
      quantityCases: wmsStockMovements.quantityCases,
      quantityBottles: wmsStockMovements.quantityBottles,
      fromOwnerId: wmsStockMovements.fromOwnerId,
      toOwnerId: wmsStockMovements.toOwnerId,
      orderId: wmsStockMovements.orderId,
      performedAt: wmsStockMovements.performedAt,
      // Full precision, for the cursor (a Date keeps only milliseconds)
      performedAtText: sql<string>`${wmsStockMovements.performedAt}::text`,
      pcoNumber: sql<string | null>`COALESCE(${privateClientOrders.orderNumber}, ${pcoViaSalesOrder.orderNumber})`,
      pcoPartnerId: sql<string | null>`COALESCE(${privateClientOrders.partnerId}, ${pcoViaSalesOrder.partnerId})::text`,
      pcoPartnerReference: sql<string | null>`COALESCE(${privateClientOrders.partnerReference}, ${pcoViaSalesOrder.partnerReference})`,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
      soForPco: sql<string | null>`COALESCE(${zohoSalesOrders.privateClientOrderId}::text, substring(${zohoSalesOrders.referenceNumber} from 'PCO-[0-9]{4}-[0-9]+'))`,
    })
    .from(wmsStockMovements)
    .leftJoin(privateClientOrders, eq(wmsStockMovements.orderId, privateClientOrders.id))
    .leftJoin(zohoSalesOrders, eq(wmsStockMovements.orderId, zohoSalesOrders.id))
    .leftJoin(
      pcoViaSalesOrder,
      or(
        eq(pcoViaSalesOrder.id, zohoSalesOrders.privateClientOrderId),
        and(
          sql`${zohoSalesOrders.privateClientOrderId} IS NULL`,
          eq(
            pcoViaSalesOrder.orderNumber,
            sql`substring(${zohoSalesOrders.referenceNumber} from 'PCO-[0-9]{4}-[0-9]+')`,
          ),
        ),
      ),
    )
    .where(
      and(
        scope.condition,
        inArray(
          wmsStockMovements.movementType,
          query.salesOnly ? [...SALE_CANDIDATE_TYPES] : [...PARTNER_MOVEMENT_TYPES],
        ),
        // A transfer voided by pointing it back at its owner moved nothing
        sql`NOT (${wmsStockMovements.movementType} = 'ownership_transfer' AND ${wmsStockMovements.fromOwnerId} IS NOT DISTINCT FROM ${wmsStockMovements.toOwnerId})`,
        decoded
          ? sql`(${wmsStockMovements.performedAt}, ${wmsStockMovements.id}) > (${decoded.at}::timestamp, ${decoded.id}::uuid)`
          : query.since
            ? gte(wmsStockMovements.performedAt, query.since)
            : undefined,
        query.until ? lt(wmsStockMovements.performedAt, query.until) : undefined,
        query.lwin18 ? eq(wmsStockMovements.lwin18, query.lwin18) : undefined,
      ),
    )
    .orderBy(asc(wmsStockMovements.performedAt), asc(wmsStockMovements.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  const [deliveries, ccIds] = await Promise.all([
    getOwnerDeliveryOwners(page.map((row) => row.orderId)),
    getCraftCultureOwnerIds(),
  ]);

  const events = page.map((row) => {
    const delivery = row.orderId ? deliveries.get(row.orderId) : undefined;
    const isPrivateClient = Boolean(row.pcoNumber || row.soForPco);
    const isOwnDelivery = delivery?.ownerId === partnerId;
    const event = classifyPartnerMovement(
      row,
      partnerId,
      {
        isOwnDelivery,
        isPrivateClient,
        isTradeOrder: Boolean(row.salesOrderNumber) && !isPrivateClient,
        isPartnersOwnOrder: isOwnDelivery || (Boolean(row.pcoNumber) && row.pcoPartnerId === partnerId),
      },
      Boolean(row.toOwnerId && ccIds.has(row.toOwnerId)),
    );

    /*
      The order number only when it is theirs to know: their own PCO, or our
      sales order reference (which names no buyer). Another partner's PCO
      number is never shown.
    */
    const onOrder =
      event.type === 'picked' || event.type === 'dispatched' || event.type === 'returned';

    const orderReference =
      row.pcoNumber && row.pcoPartnerId === partnerId
        ? row.pcoNumber
        : row.pcoNumber
          ? null
          : (row.salesOrderNumber ?? null);

    return {
      id: row.id,
      reference: row.movementNumber,
      occurredAt: row.performedAt.toISOString(),
      ...event,
      wine: wineFromLwin(row.lwin18, row.productName),
      orderReference: onOrder ? orderReference : null,
      // The partner's own reference (their SO number), on their own orders only
      yourReference:
        onOrder && row.pcoNumber && row.pcoPartnerId === partnerId
          ? (row.pcoPartnerReference ?? null)
          : null,
    };
  });

  const last = page.at(-1);
  // Returns travel with sales, so a sale can be credited from the same feed
  const data = query.salesOnly
    ? events.filter((event) => event.outcome === 'sale' || event.type === 'returned')
    : events;

  return {
    data,
    meta: {
      /** Send back as `cursor` to continue; also the bookmark to sync from later */
      nextCursor: last ? movementCursor.encode(last.performedAtText, last.id) : (query.cursor ?? null),
      hasMore,
      /** Wines held with another owner, whose unstamped history is withheld */
      sharedWineCount: scope.sharedWineCount,
    },
  };
};

export default getPartnerMovementEvents;

import { and, eq, inArray, or } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarReleaseRequests,
  privateClientOrders,
  zohoSalesOrders,
} from '@/database/schema';

/**
 * Which of these orders are a member's own delivery, and whose
 *
 * A cellar release becomes a private client order (owner_delivery). It can
 * reach the warehouse as that order, or as a Zoho sales order whose reference
 * is the PCO number — SO-00225 to City Drinks carried PCO-2026-00102, Ihab
 * Toma's delivery of his own Echézeaux and Gaunoux. Both routes are the
 * member's own wine going to them, not a sale, so statements, the outflow
 * report and the pick guard all ask here rather than reading the order kind
 * off only one of them.
 *
 * @example
 *   const owners = await getOwnerDeliveryOwners([pickList.orderId]);
 *   owners.get(pickList.orderId); // the member's partner id, if a delivery
 *
 * @param orderIds - PCO or Zoho sales order ids, as stored on picks
 * @returns Map of order id → { ownerId, pcoNumber, status, deliveredAt }
 */
const getOwnerDeliveryOwners = async (orderIds: (string | null)[]) => {
  const ids = [...new Set(orderIds.filter((id): id is string => !!id))];
  const result = new Map<
    string,
    {
      ownerId: string;
      pcoNumber: string;
      status: string;
      deliveredAt: Date | null;
    }
  >();
  if (ids.length === 0) return result;

  const salesOrders = await db
    .select({
      id: zohoSalesOrders.id,
      pcoId: zohoSalesOrders.privateClientOrderId,
      ref: zohoSalesOrders.referenceNumber,
    })
    .from(zohoSalesOrders)
    .where(inArray(zohoSalesOrders.id, ids));
  // The stored link first; the reference text only until the sync has linked it
  const linkedPcoIds = salesOrders
    .map((row) => row.pcoId)
    .filter((id): id is string => !!id);
  const refs = salesOrders
    .filter((row) => !row.pcoId)
    .map((row) => row.ref?.match(/PCO-\d{4}-\d+/i)?.[0]?.toUpperCase())
    .filter((ref): ref is string => !!ref);

  const deliveries = await db
    .select({
      pcoId: privateClientOrders.id,
      pcoNumber: privateClientOrders.orderNumber,
      status: privateClientOrders.status,
      deliveredAt: privateClientOrders.deliveredAt,
      ownerId: cellarReleaseRequests.partnerId,
    })
    .from(privateClientOrders)
    .innerJoin(
      cellarReleaseRequests,
      eq(cellarReleaseRequests.privateClientOrderId, privateClientOrders.id),
    )
    .where(
      and(
        eq(privateClientOrders.orderKind, 'owner_delivery'),
        or(
          inArray(privateClientOrders.id, [...ids, ...linkedPcoIds]),
          refs.length ? inArray(privateClientOrders.orderNumber, refs) : undefined,
        ),
      ),
    );

  const byPcoId = new Map(deliveries.map((row) => [row.pcoId, row]));
  const byNumber = new Map(deliveries.map((row) => [row.pcoNumber, row]));
  const describe = (row: (typeof deliveries)[number]) => ({
    ownerId: row.ownerId,
    pcoNumber: row.pcoNumber,
    status: row.status,
    deliveredAt: row.deliveredAt,
  });

  for (const id of ids) {
    const direct = byPcoId.get(id);
    if (direct) result.set(id, describe(direct));
  }
  for (const so of salesOrders) {
    const refNumber = so.ref?.match(/PCO-\d{4}-\d+/i)?.[0]?.toUpperCase();
    const viaRef = so.pcoId
      ? byPcoId.get(so.pcoId)
      : refNumber
        ? byNumber.get(refNumber)
        : undefined;
    if (viaRef) result.set(so.id, describe(viaRef));
  }

  return result;
};

export default getOwnerDeliveryOwners;

import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarUkMoveItems,
  cellarUkMoves,
  logisticsShipments,
  partners,
} from '@/database/schema';

import ukMoveDisplayStatus from '../utils/ukMoveDisplayStatus';

/**
 * UK moves with their lines and shipment, newest first
 *
 * Shared by the member's cellar and the team's queue so the two never
 * disagree about where a move is. Carries the itemised quote: the member
 * controller is responsible for stripping it.
 *
 * @param partnerId - One member's moves, or every member's when omitted
 * @returns Moves with items, shipment and display status
 */
const getUkMoves = async (partnerId?: string) => {
  const moves = await db
    .select({
      id: cellarUkMoves.id,
      moveNumber: cellarUkMoves.moveNumber,
      partnerId: cellarUkMoves.partnerId,
      partnerName: partners.businessName,
      status: cellarUkMoves.status,
      memberNotes: cellarUkMoves.memberNotes,
      adminNotes: cellarUkMoves.adminNotes,
      freightUsd: cellarUkMoves.freightUsd,
      lcbChargesUsd: cellarUkMoves.lcbChargesUsd,
      otherUsd: cellarUkMoves.otherUsd,
      otherLabel: cellarUkMoves.otherLabel,
      totalUsd: cellarUkMoves.totalUsd,
      quotedAt: cellarUkMoves.quotedAt,
      acceptedAt: cellarUkMoves.acceptedAt,
      shippedAt: cellarUkMoves.shippedAt,
      closedAt: cellarUkMoves.closedAt,
      createdAt: cellarUkMoves.createdAt,
      shipmentId: cellarUkMoves.shipmentId,
      shipmentNumber: logisticsShipments.shipmentNumber,
      shipmentStatus: logisticsShipments.status,
      shipmentEta: logisticsShipments.eta,
      deliveredAt: logisticsShipments.deliveredAt,
    })
    .from(cellarUkMoves)
    .leftJoin(partners, eq(partners.id, cellarUkMoves.partnerId))
    .leftJoin(
      logisticsShipments,
      eq(logisticsShipments.id, cellarUkMoves.shipmentId),
    )
    .where(partnerId ? eq(cellarUkMoves.partnerId, partnerId) : undefined)
    .orderBy(desc(cellarUkMoves.createdAt))
    .limit(200);

  if (moves.length === 0) return [];

  const items = await db
    .select()
    .from(cellarUkMoveItems)
    .where(
      inArray(
        cellarUkMoveItems.moveId,
        moves.map((move) => move.id),
      ),
    )
    .orderBy(cellarUkMoveItems.rotation, cellarUkMoveItems.line);

  const byMove = new Map<string, typeof items>();

  for (const item of items) {
    byMove.set(item.moveId, [...(byMove.get(item.moveId) ?? []), item]);
  }

  return moves.map((move) => ({
    ...move,
    displayStatus: ukMoveDisplayStatus(move.status, move.shipmentStatus),
    items: byMove.get(move.id) ?? [],
  }));
};

export default getUkMoves;

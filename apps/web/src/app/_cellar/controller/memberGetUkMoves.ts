import { and, asc, inArray, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentActivityLogs } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getUkMoves from '../data/getUkMoves';

/** Statuses at which the member has been given a figure */
const PRICED = ['quoted', 'accepted', 'shipping', 'arrived'];

/**
 * The member's requests to bring UK wine to the UAE
 *
 * One all-in figure, never the freight and LCB charges behind it — the same
 * rule as a delivery quote. Never throws: if the tables are missing the
 * cellar simply offers no moves.
 *
 * @example
 *   const { moves } = await trpcClient.cellar.member.getUkMoves.query();
 */
const memberGetUkMoves = stockOwnerProcedure.query(async ({ ctx }) => {
  try {
    const moves = await getUkMoves(ctx.partner.id);

    // When each move's shipment first reached each status, for the member's tracker
    const shipmentIds = [...new Set(moves.map((move) => move.shipmentId).filter((id): id is string => Boolean(id)))];
    const changes = shipmentIds.length
      ? await db
          .select({
            shipmentId: logisticsShipmentActivityLogs.shipmentId,
            status: logisticsShipmentActivityLogs.newStatus,
            at: logisticsShipmentActivityLogs.createdAt,
          })
          .from(logisticsShipmentActivityLogs)
          .where(
            and(
              inArray(logisticsShipmentActivityLogs.shipmentId, shipmentIds),
              isNotNull(logisticsShipmentActivityLogs.newStatus),
            ),
          )
          .orderBy(asc(logisticsShipmentActivityLogs.createdAt))
      : [];
    const reachedAtFor = (shipmentId: string | null) => {
      const reached: Record<string, string> = {};
      for (const change of changes) {
        if (change.shipmentId === shipmentId && change.status && !reached[change.status]) {
          reached[change.status] = change.at.toISOString();
        }
      }
      return reached;
    };

    return {
      moves: moves.map((move) => ({
        id: move.id,
        moveNumber: move.moveNumber,
        status: move.displayStatus,
        memberNotes: move.memberNotes,
        adminNotes: move.adminNotes,
        totalUsd: PRICED.includes(move.displayStatus) ? move.totalUsd : null,
        quotedAt: move.quotedAt,
        acceptedAt: move.acceptedAt,
        shippedAt: move.shippedAt,
        createdAt: move.createdAt,
        eta: move.shipmentEta,
        shipmentStatus: move.shipmentStatus,
        reachedAt: reachedAtFor(move.shipmentId),
        arrivedAt: move.displayStatus === 'arrived' ? move.deliveredAt : null,
        items: move.items.map((item) => ({
          id: item.id,
          rotation: item.rotation,
          line: item.line,
          name: item.name,
          vintage: item.vintage,
          bottlesPerCase: item.bottlesPerCase,
          bottleSizeLitres: item.bottleSizeLitres,
          cases: item.cases,
          singles: item.singles,
          totalBottles: item.totalBottles,
        })),
      })),
    };
  } catch (error) {
    logger.error('Could not read a member’s UK moves', {
      partnerId: ctx.partner.id,
      error,
    });
    return { moves: [] };
  }
});

export default memberGetUkMoves;

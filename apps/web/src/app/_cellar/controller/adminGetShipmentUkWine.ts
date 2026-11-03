import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarMemberships,
  cellarUkHoldings,
  cellarUkMoveItems,
  cellarUkMoves,
  cellarUkRotations,
  logisticsShipments,
  lwinWines,
  partners,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { OPEN_UK_MOVE_STATUSES } from '../constants/ukMoveStatuses';

/**
 * A cellar member's wine at LCB Burton, seen from an inbound shipment
 *
 * Feeds the shipment page's "UK cellar wine" panel: the moves already on this
 * shipment, and the member's LCB lines with whether each is free to add or
 * already on a move. Empty unless the shipment is inbound and its client holds
 * UK wine, so the panel stays out of the way on every other shipment.
 *
 * Never throws: before the UK tables exist the panel simply does not show.
 *
 * @example
 *   await trpcClient.cellar.admin.getShipmentUkWine.query({ shipmentId });
 */
const adminGetShipmentUkWine = staffAdminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .query(async ({ input }) => {
    const empty = { member: null, holdings: [], moves: [] };

    try {
      const [shipment] = await db
        .select({
          type: logisticsShipments.type,
          partnerId: logisticsShipments.partnerId,
          memberName: partners.businessName,
        })
        .from(logisticsShipments)
        .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
        .where(eq(logisticsShipments.id, input.shipmentId))
        .limit(1);

      if (!shipment || shipment.type !== 'inbound' || !shipment.partnerId) return empty;

      const partnerId = shipment.partnerId;

      const [holdings, openItems, moves, membership] = await Promise.all([
        db
          .select({
            id: cellarUkHoldings.id,
            rotation: cellarUkHoldings.rotation,
            line: cellarUkHoldings.line,
            lwin18: cellarUkHoldings.lwin18,
            brand: cellarUkHoldings.brand,
            description: cellarUkHoldings.description,
            vintage: cellarUkHoldings.vintage,
            bottlesPerCase: cellarUkHoldings.bottlesPerCase,
            bottleSizeLitres: cellarUkHoldings.bottleSizeLitres,
            cases: cellarUkHoldings.cases,
            singles: cellarUkHoldings.singles,
            totalBottles: cellarUkHoldings.totalBottles,
          })
          .from(cellarUkHoldings)
          .innerJoin(cellarUkRotations, eq(cellarUkHoldings.rotation, cellarUkRotations.rotation))
          .where(eq(cellarUkRotations.partnerId, partnerId))
          .orderBy(cellarUkHoldings.description, cellarUkHoldings.vintage),
        db
          .select({
            rotation: cellarUkMoveItems.rotation,
            line: cellarUkMoveItems.line,
            moveNumber: cellarUkMoves.moveNumber,
            status: cellarUkMoves.status,
          })
          .from(cellarUkMoveItems)
          .innerJoin(cellarUkMoves, eq(cellarUkMoves.id, cellarUkMoveItems.moveId))
          .where(and(eq(cellarUkMoves.partnerId, partnerId), inArray(cellarUkMoves.status, OPEN_UK_MOVE_STATUSES))),
        db
          .select({
            id: cellarUkMoves.id,
            moveNumber: cellarUkMoves.moveNumber,
            status: cellarUkMoves.status,
            memberName: partners.businessName,
          })
          .from(cellarUkMoves)
          .leftJoin(partners, eq(partners.id, cellarUkMoves.partnerId))
          .where(eq(cellarUkMoves.shipmentId, input.shipmentId)),
        db
          .select({ partnerId: cellarMemberships.partnerId })
          .from(cellarMemberships)
          .where(eq(cellarMemberships.partnerId, partnerId))
          .limit(1),
      ]);

      const moveItems = moves.length
        ? await db
            .select()
            .from(cellarUkMoveItems)
            .where(inArray(cellarUkMoveItems.moveId, moves.map((move) => move.id)))
        : [];

      if (holdings.length === 0 && moves.length === 0 && membership.length === 0) return empty;

      const lwin7s = [
        ...new Set(holdings.map((row) => row.lwin18.slice(0, 7)).filter((code) => /^\d{7}$/.test(code))),
      ];

      const names = lwin7s.length
        ? await db
            .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
            .from(lwinWines)
            .where(inArray(lwinWines.lwin, lwin7s))
        : [];

      const nameByLwin = new Map(names.map((row) => [row.lwin, row.displayName]));
      const takenBy = new Map(openItems.map((item) => [`${item.rotation}:${item.line}`, item]));

      return {
        member: { id: partnerId, name: shipment.memberName },
        holdings: holdings.map((row) => ({
          ...row,
          name:
            nameByLwin.get(row.lwin18.slice(0, 7)) ??
            (row.brand && row.brand !== 'NA' ? row.brand : row.description) ??
            'Wine',
          onMove: takenBy.get(`${row.rotation}:${row.line}`) ?? null,
        })),
        moves: moves.map((move) => ({
          ...move,
          items: moveItems.filter((item) => item.moveId === move.id),
        })),
      };
    } catch (error) {
      logger.error('Could not read UK cellar wine for a shipment', { shipmentId: input.shipmentId, error });
      return empty;
    }
  });

export default adminGetShipmentUkWine;

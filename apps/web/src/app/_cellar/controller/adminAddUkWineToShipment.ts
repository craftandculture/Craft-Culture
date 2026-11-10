import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import isUniqueViolation from '@/app/_logistics/utils/isUniqueViolation';
import recalcShipmentTotals from '@/app/_logistics/utils/recalcShipmentTotals';
import db from '@/database/client';
import { cellarUkMoveItems, cellarUkMoves, logisticsShipments, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { CLOSED_SHIPMENT_STATUSES } from '../constants/closedShipmentStatuses';
import putUkMoveOnShipment from '../data/putUkMoveOnShipment';
import resolveUkMoveLines from '../data/resolveUkMoveLines';
import generateUkMoveNumber from '../utils/generateUkMoveNumber';
import notifyUkMoveUpdate from '../utils/notifyUkMoveUpdate';


/**
 * Add a cellar member's UK wine to an inbound shipment the team already arranged
 *
 * The other way into a UK move. A member normally asks, the team quotes and
 * the member accepts, then the move is shipped. When the team arranges the
 * freight first, from a freight quote, the shipment exists and the move does
 * not, and the two never met: the member saw nothing on its way and the
 * shipment carried no wine to receive. This raises the move for the member,
 * already accepted (the price is the freight quote's), and puts it on the
 * shipment through the same step as the moves list, so the wine reads as on
 * its way and receiving books it to the member's cellar.
 *
 * @example
 *   await trpcClient.cellar.admin.addUkWineToShipment.mutate({
 *     shipmentId, holdingIds: [id], casesByHolding: { [id]: 2 },
 *   });
 */
const adminAddUkWineToShipment = staffAdminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      holdingIds: z
        .array(z.string().uuid())
        .min(1)
        .max(1000)
        .refine((ids) => new Set(ids).size === ids.length, { message: 'A wine was chosen twice' }),
      casesByHolding: z.record(z.string().uuid(), z.number().int().min(1)).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [shipment] = await db
      .select({
        type: logisticsShipments.type,
        status: logisticsShipments.status,
        partnerId: logisticsShipments.partnerId,
        memberName: partners.businessName,
      })
      .from(logisticsShipments)
      .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
      .where(eq(logisticsShipments.id, input.shipmentId))
      .limit(1);

    if (!shipment || shipment.type !== 'inbound') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'UK wine can only be added to an inbound shipment.' });
    }

    if (!shipment.partnerId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Set the client on this shipment first.' });
    }

    if (CLOSED_SHIPMENT_STATUSES.includes(shipment.status)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Receiving has started on this shipment, so its lines can no longer change.',
      });
    }

    const partnerId = shipment.partnerId;

    const create = (attempt: number) =>
      db.transaction(async (tx) => {
        const items = await resolveUkMoveLines(tx, partnerId, input.holdingIds, input.casesByHolding);
        const moveNumber = await generateUkMoveNumber(tx, attempt);
        const now = new Date();

        const [move] = await tx
          .insert(cellarUkMoves)
          .values({
            moveNumber,
            partnerId,
            status: 'accepted',
            acceptedAt: now,
            createdBy: ctx.user.id,
          })
          .returning({ id: cellarUkMoves.id, moveNumber: cellarUkMoves.moveNumber });

        if (!move) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not create the move' });
        }

        await tx.insert(cellarUkMoveItems).values(items.map((item) => ({ ...item, moveId: move.id })));

        await putUkMoveOnShipment(tx, {
          moveId: move.id,
          moveNumber: move.moveNumber,
          partnerId,
          memberName: shipment.memberName,
          shipmentId: input.shipmentId,
          userId: ctx.user.id,
        });

        return { ...move, cases: items.reduce((sum, item) => sum + item.cases, 0) };
      });

    let move: Awaited<ReturnType<typeof create>> | undefined;

    for (let attempt = 0; attempt < 3 && !move; attempt += 1) {
      try {
        move = await create(attempt);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 2) throw error;
      }
    }

    if (!move) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not create the move' });
    }

    await recalcShipmentTotals(input.shipmentId);

    await notifyUkMoveUpdate({
      event: 'shipping',
      partnerId,
      moveId: move.id,
      moveNumber: move.moveNumber,
    });

    return move;
  });

export default adminAddUkWineToShipment;

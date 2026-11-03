import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import generateShipmentNumber from '@/app/_logistics/utils/generateShipmentNumber';
import recalcShipmentTotals from '@/app/_logistics/utils/recalcShipmentTotals';
import db from '@/database/client';
import {
  cellarUkMoves,
  logisticsShipmentActivityLogs,
  logisticsShipments,
  partners,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import putUkMoveOnShipment from '../data/putUkMoveOnShipment';
import notifyUkMoveUpdate from '../utils/notifyUkMoveUpdate';

/**
 * Put an accepted UK move on an inbound shipment to the UAE
 *
 * Either creates the shipment — owned by the member, not for sale, with one
 * line per LCB case line and one per loose bottles — or links an existing one
 * when several moves travel together. From there it is an ordinary inbound
 * shipment: receiving it puts the wine into the member's UAE cellar, and the
 * move reads as arrived.
 *
 * The move's lines are added either way, by putUkMoveOnShipment: on someone
 * else's shipment each line names the member as its owner, and a shipment
 * with no client becomes the member's.
 *
 * @example
 *   await trpcClient.cellar.admin.shipUkMove.mutate({
 *     moveId, mode: 'create', transportMode: 'sea_lcl',
 *   });
 */
const adminShipUkMove = staffAdminProcedure
  .input(
    z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('create'),
        moveId: z.string().uuid(),
        transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']),
      }),
      z.object({
        mode: z.literal('link'),
        moveId: z.string().uuid(),
        shipmentId: z.string().uuid(),
      }),
    ]),
  )
  .mutation(async ({ ctx, input }) => {
    const [move] = await db
      .select()
      .from(cellarUkMoves)
      .where(eq(cellarUkMoves.id, input.moveId))
      .limit(1);

    if (!move) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Move not found' });
    }

    if (move.status !== 'accepted' || move.shipmentId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Only an accepted move that is not yet on a shipment can be shipped.',
      });
    }

    const [member] = await db
      .select({ name: partners.businessName })
      .from(partners)
      .where(eq(partners.id, move.partnerId))
      .limit(1);

    const shipmentId = await db.transaction(async (tx) => {
      let id: string;

      if (input.mode === 'link') {
        id = input.shipmentId;
      } else {
        const shipmentNumber = await generateShipmentNumber();

        const [shipment] = await tx
          .insert(logisticsShipments)
          .values({
            shipmentNumber,
            name: `${move.moveNumber} · LCB Burton to UAE`,
            type: 'inbound',
            transportMode: input.transportMode,
            status: 'draft',
            partnerId: move.partnerId,
            /* A member's own wine, never C&C supply */
            notForSale: true,
            originCountry: 'United Kingdom',
            originCity: 'Burton upon Trent',
            originWarehouse: 'London City Bond, Burton Gateway',
            destinationCountry: 'United Arab Emirates',
            internalNotes: `Member move ${move.moveNumber}. LCB Vision export order Your Ref ${move.moveNumber}.`,
            createdBy: ctx.user.id,
          })
          .returning({ id: logisticsShipments.id });

        if (!shipment) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not create the shipment',
          });
        }

        id = shipment.id;

        await tx.insert(logisticsShipmentActivityLogs).values({
          shipmentId: id,
          userId: ctx.user.id,
          action: 'created',
          newStatus: 'draft',
          notes: `Shipment ${shipmentNumber} created for member move ${move.moveNumber}`,
        });
      }

      await putUkMoveOnShipment(tx, {
        moveId: move.id,
        moveNumber: move.moveNumber,
        partnerId: move.partnerId,
        memberName: member?.name ?? null,
        shipmentId: id,
        userId: ctx.user.id,
      });

      return id;
    });

    await recalcShipmentTotals(shipmentId);

    await notifyUkMoveUpdate({
      event: 'shipping',
      partnerId: move.partnerId,
      moveId: move.id,
      moveNumber: move.moveNumber,
    });

    return { shipmentId };
  });

export default adminShipUkMove;

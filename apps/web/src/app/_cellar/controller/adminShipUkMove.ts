import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import generateShipmentNumber from '@/app/_logistics/utils/generateShipmentNumber';
import recalcShipmentTotals from '@/app/_logistics/utils/recalcShipmentTotals';
import db from '@/database/client';
import {
  cellarUkMoveItems,
  cellarUkMoves,
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

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
 * Lines are added only when the shipment is created here. A linked shipment
 * is the team's to fill, since it may already carry the same wine.
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

    const shipmentId = await db.transaction(async (tx) => {
      let id: string;

      if (input.mode === 'link') {
        const [existing] = await tx
          .select({ id: logisticsShipments.id, type: logisticsShipments.type })
          .from(logisticsShipments)
          .where(eq(logisticsShipments.id, input.shipmentId))
          .limit(1);

        if (!existing || existing.type !== 'inbound') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Choose an inbound shipment.',
          });
        }

        id = existing.id;
      } else {
        const items = await tx
          .select()
          .from(cellarUkMoveItems)
          .where(eq(cellarUkMoveItems.moveId, move.id));

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

        const bottleSizeMl = (litres: number | null) =>
          litres ? Math.round(litres * 1000) : 750;

        const lines = items.flatMap((item) => {
          const base = {
            shipmentId: id,
            productName: item.name,
            lwin: item.lwin18,
            vintage: item.vintage,
            bottleSizeMl: bottleSizeMl(item.bottleSizeLitres),
            notForSale: true,
          };

          const caseLine =
            item.cases > 0 && item.bottlesPerCase
              ? [
                  {
                    ...base,
                    cases: item.cases,
                    bottlesPerCase: item.bottlesPerCase,
                    totalBottles: item.cases * item.bottlesPerCase,
                  },
                ]
              : [];

          const looseBottles = item.totalBottles - caseLine.reduce((sum, line) => sum + line.totalBottles, 0);

          const looseLine =
            looseBottles > 0
              ? [{ ...base, cases: looseBottles, bottlesPerCase: 1, totalBottles: looseBottles }]
              : [];

          return [...caseLine, ...looseLine];
        });

        if (lines.length > 0) {
          await tx.insert(logisticsShipmentItems).values(lines);
        }

        await tx.insert(logisticsShipmentActivityLogs).values({
          shipmentId: id,
          userId: ctx.user.id,
          action: 'created',
          newStatus: 'draft',
          notes: `Shipment ${shipmentNumber} created for member move ${move.moveNumber}`,
        });
      }

      const [claimed] = await tx
        .update(cellarUkMoves)
        .set({ status: 'shipping', shipmentId: id, shippedAt: new Date() })
        .where(
          and(
            eq(cellarUkMoves.id, move.id),
            eq(cellarUkMoves.status, 'accepted'),
            isNull(cellarUkMoves.shipmentId),
          ),
        )
        .returning({ id: cellarUkMoves.id });

      if (!claimed) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This move was shipped by someone else a moment ago.',
        });
      }

      return id;
    });

    if (input.mode === 'create') {
      await recalcShipmentTotals(shipmentId);
    }

    await notifyUkMoveUpdate({
      event: 'shipping',
      partnerId: move.partnerId,
      moveId: move.id,
      moveNumber: move.moveNumber,
    });

    return { shipmentId };
  });

export default adminShipUkMove;

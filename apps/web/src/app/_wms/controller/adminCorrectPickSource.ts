import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockMovements,
  wmsStockReservations,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import convertReservationToPick from '../utils/convertReservationToPick';
import moveBottlesToSingles from '../utils/moveBottlesToSingles';
import planStockOut from '../utils/planStockOut';

/**
 * Move a pick onto the stock row the bottles actually came from
 *
 * A pick records whose bottles left, and every owner view reads it: the
 * member's statement, deliveries, consignment sales and payouts. When the
 * system deducted the wrong row, the warehouse took the right bottle but the
 * books said otherwise. PL-2026-0147 took Ihab Toma's Bonnes Mares for his own
 * delivery and booked it against Alain Brahamcha's magnum, so Ihab's delivery
 * showed four bottles and Alain's statement showed one leaving.
 *
 * The wrong row gets its cases back, the right row gives up the bottles the
 * way a split-case pick would (loose first, then a case opened, the rest
 * becoming singles), and the movement and pick line are re-pointed with a
 * note saying what they said before. Nothing is deleted.
 *
 * Only whole-case picks can be reversed off the wrong row: undoing a cracked
 * case means rebuilding the case from its singles, which is left to a person.
 *
 * Preview first (`dryRun`), then save.
 *
 * @example
 *   await trpcClient.wms.admin.stock.correctPickSource.mutate({
 *     movementId, correctStockId, dryRun: true,
 *   });
 */
const adminCorrectPickSource = staffAdminProcedure
  .input(
    z.object({
      movementId: z.string().uuid(),
      correctStockId: z.string().uuid(),
      dryRun: z.boolean().default(true),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const by = ctx.user.name ?? ctx.user.email;

    const run = async (tx: typeof db) => {
      const [movement] = await tx
        .select()
        .from(wmsStockMovements)
        .where(eq(wmsStockMovements.id, input.movementId))
        .for('update');
      if (!movement) throw new TRPCError({ code: 'NOT_FOUND', message: 'Movement not found' });
      if (movement.movementType !== 'pick') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a pick can be moved to another stock row.' });
      }
      if (!movement.stockId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This pick does not record which row it came from.' });
      }
      if (movement.stockId === input.correctStockId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The pick is already on that row.' });
      }

      const [wrong] = await tx.select().from(wmsStock).where(eq(wmsStock.id, movement.stockId)).for('update');
      const [right] = await tx.select().from(wmsStock).where(eq(wmsStock.id, input.correctStockId)).for('update');
      if (!wrong) throw new TRPCError({ code: 'NOT_FOUND', message: 'The row the pick was booked to is no longer there.' });
      if (!right) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock row not found' });

      const wrongPack = wrong.caseConfig ?? 12;
      const bottles = movement.quantityBottles ?? movement.quantityCases * wrongPack;
      // A whole-case pick off the wrong row: cases out, bottles = cases × pack
      if (movement.quantityCases <= 0 || bottles !== movement.quantityCases * wrongPack) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This pick opened a case on the wrong row. Put that case back together by hand, then correct the pick.',
        });
      }

      // Bottles from the right row, counting cases held for this same order as takeable
      const orderIds = [movement.orderId].filter((id): id is string => !!id);
      if (movement.orderId) {
        const [so] = await tx
          .select({ pcoId: zohoSalesOrders.privateClientOrderId })
          .from(zohoSalesOrders)
          .where(eq(zohoSalesOrders.id, movement.orderId));
        if (so?.pcoId) orderIds.push(so.pcoId);
      }
      let heldForOrder = 0;
      for (const orderId of orderIds) {
        const [held] = await tx
          .select({ cases: sql<number>`COALESCE(SUM(${wmsStockReservations.quantityCases}), 0)::int` })
          .from(wmsStockReservations)
          .where(
            and(
              eq(wmsStockReservations.stockId, right.id),
              eq(wmsStockReservations.orderId, orderId),
              eq(wmsStockReservations.status, 'active'),
            ),
          );
        heldForOrder += held?.cases ?? 0;
      }

      const rightPack = right.caseConfig ?? 12;
      const plan = planStockOut(
        {
          quantityCases: right.quantityCases,
          availableCases: right.availableCases + heldForOrder,
          openBottles: right.openBottles,
          pack: rightPack,
        },
        'bottle',
        bottles,
      );
      if (!plan.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: plan.error });

      const [names] = await tx
        .select({
          wrongOwner: sql<string | null>`(SELECT business_name FROM ${partners} WHERE id = ${wrong.ownerId})`,
          rightOwner: sql<string | null>`(SELECT business_name FROM ${partners} WHERE id = ${right.ownerId})`,
          wrongBay: sql<string | null>`(SELECT location_code FROM ${wmsLocations} WHERE id = ${wrong.locationId})`,
          rightBay: sql<string | null>`(SELECT location_code FROM ${wmsLocations} WHERE id = ${right.locationId})`,
        })
        .from(sql`(SELECT 1) AS one`);

      const preview = {
        movementNumber: movement.movementNumber,
        bottles,
        from: { stockId: wrong.id, lwin18: wrong.lwin18, owner: names?.wrongOwner, bay: names?.wrongBay, casesBack: movement.quantityCases },
        to: {
          stockId: right.id,
          lwin18: right.lwin18,
          owner: names?.rightOwner,
          bay: names?.rightBay,
          casesOpened: plan.casesRemoved,
          singlesLeft: rightPack > 1 ? plan.leftover : 0,
        },
      };
      if (input.dryRun) return { saved: false, ...preview };

      const now = new Date();

      // The wrong row gets its cases back
      await tx
        .update(wmsStock)
        .set({
          quantityCases: sql`${wmsStock.quantityCases} + ${movement.quantityCases}`,
          availableCases: sql`${wmsStock.availableCases} + ${movement.quantityCases}`,
          updatedAt: now,
        })
        .where(eq(wmsStock.id, wrong.id));

      // The right row gives up the bottles: loose first, then cases, held-for-this-order first
      const opensCases = rightPack > 1;
      if (plan.openBottlesUsed > 0 || opensCases) {
        await tx.update(wmsStock).set({ openBottles: 0, updatedAt: now }).where(eq(wmsStock.id, right.id));
      }
      // Cases held for this order (as the SO or its PCO) go first, then unreserved ones
      let toTake = plan.casesRemoved;
      for (const orderId of orderIds) {
        if (toTake <= 0) break;
        const [held] = await tx
          .select({ cases: sql<number>`COALESCE(SUM(${wmsStockReservations.quantityCases}), 0)::int` })
          .from(wmsStockReservations)
          .where(
            and(
              eq(wmsStockReservations.stockId, right.id),
              eq(wmsStockReservations.orderId, orderId),
              eq(wmsStockReservations.status, 'active'),
            ),
          );
        const fromHeld = Math.min(toTake, held?.cases ?? 0);
        if (fromHeld > 0) {
          await convertReservationToPick({ stockId: right.id, orderId, quantityCases: fromHeld, db: tx });
          toTake -= fromHeld;
        }
      }
      if (toTake > 0) {
        await tx
          .update(wmsStock)
          .set({
            quantityCases: sql`${wmsStock.quantityCases} - ${toTake}`,
            availableCases: sql`${wmsStock.availableCases} - ${toTake}`,
            updatedAt: now,
          })
          .where(eq(wmsStock.id, right.id));
      }
      if (opensCases && plan.leftover > 0) {
        await moveBottlesToSingles({
          sourceStockId: right.id,
          bottles: plan.leftover,
          performedBy: ctx.user.id,
          performedAt: movement.performedAt,
          db: tx,
        });
      }

      const before = `was ${wrong.lwin18} at ${names?.wrongBay ?? '—'} (${names?.wrongOwner ?? 'unknown owner'})`;
      await tx
        .update(wmsStockMovements)
        .set({
          stockId: right.id,
          fromOwnerId: right.ownerId,
          fromLocationId: right.locationId,
          lwin18: right.lwin18,
          quantityCases: plan.casesRemoved,
          quantityBottles: bottles,
          notes: [
            movement.notes,
            `Corrected by ${by} on ${now.toISOString().slice(0, 10)}: booked to the wrong row, ${before}`,
            input.note,
          ]
            .filter(Boolean)
            .join(' · '),
          updatedAt: now,
        })
        .where(eq(wmsStockMovements.id, movement.id));

      // The pick line, so the list and dispatch read the bottles that left
      if (movement.orderId) {
        await tx
          .update(wmsPickListItems)
          .set({
            pickedStockId: right.id,
            pickedFromLocationId: right.locationId,
            lwin18: right.lwin18,
            quantityBottles: rightPack > 1 ? bottles : null,
            pickedQuantity: rightPack > 1 ? bottles : plan.casesRemoved,
            updatedAt: now,
          })
          .where(
            and(
              eq(wmsPickListItems.pickedStockId, wrong.id),
              sql`${wmsPickListItems.pickListId} IN (SELECT ${wmsPickLists.id} FROM ${wmsPickLists} WHERE ${wmsPickLists.orderId} = ${movement.orderId})`,
            ),
          );
        await tx
          .update(zohoSalesOrderItems)
          .set({ stockId: right.id, updatedAt: now })
          .where(
            and(
              eq(zohoSalesOrderItems.salesOrderId, movement.orderId),
              sql`(${zohoSalesOrderItems.stockId} IS NULL OR ${zohoSalesOrderItems.stockId} = ${wrong.id})`,
              sql`split_part(${zohoSalesOrderItems.sku}, '-', 1) || '-' || split_part(${zohoSalesOrderItems.sku}, '-', 2) = ${right.lwin18.split('-').slice(0, 2).join('-')}`,
            ),
          );
      }

      return { saved: true, ...preview };
    };

    // A preview reads under the same locks as a save, so it shows what a save would do
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await db.transaction(async (tx) => run(tx as any));
  });

export default adminCorrectPickSource;

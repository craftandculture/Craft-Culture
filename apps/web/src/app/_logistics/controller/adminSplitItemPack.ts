import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recalcShipmentTotals from '../utils/recalcShipmentTotals';
import splitLineAmounts from '../utils/splitLineAmounts';
import withLwinPack from '../utils/withLwinPack';

const packSchema = z.object({
  cases: z.number().int().min(1),
  bottlesPerCase: z.number().int().min(1).max(24),
});

/** Once receiving has begun, lines are what the warehouse counted against */
const LOCKED_STATUSES = ['partially_received', 'dispatched', 'delivered', 'cancelled'];

/**
 * Split a shipment line into two pack sizes of the same wine
 *
 * Packing lists ship one wine as "3x6 + 1x3": one billed row, two kinds of
 * box. The line keeps one pack and a new line, placed directly under it,
 * takes the other — same wine, owner, HS code and price per bottle, with its
 * own LWIN pack digits so it is received as the box it is. The billed total,
 * value, weight and any allocated costs are divided by bottles, so the two
 * lines add back to exactly what the line said before.
 *
 * Refused once receiving has started, because the warehouse has counted
 * against the lines as they stand.
 *
 * @param itemId - The line to split
 * @param keep - The pack and cases that stay on this line
 * @param add - The pack and cases for the new line
 * @returns The updated line and the new one
 */
const adminSplitItemPack = adminProcedure
  .input(
    z.object({
      itemId: z.string().uuid(),
      keep: packSchema,
      add: packSchema,
    }),
  )
  .mutation(async ({ input }) => {
    const { itemId, keep, add } = input;

    const [item] = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.id, itemId));

    if (!item) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment line not found' });
    }

    const [shipment] = await db
      .select({ status: logisticsShipments.status })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, item.shipmentId));

    if (shipment && LOCKED_STATUSES.includes(shipment.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Receiving has started on this shipment, so its lines can no longer be split.',
      });
    }

    const keepBottles = keep.cases * keep.bottlesPerCase;
    const addBottles = add.cases * add.bottlesPerCase;
    const amounts = splitLineAmounts(item, keepBottles, addBottles);

    const result = await db.transaction(async (tx) => {
      const [kept] = await tx
        .update(logisticsShipmentItems)
        .set({
          cases: keep.cases,
          bottlesPerCase: keep.bottlesPerCase,
          totalBottles: keepBottles,
          lwin: withLwinPack(item.lwin, keep.bottlesPerCase),
          ...amounts.keep,
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipmentItems.id, item.id))
        .returning();

      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...copy } = item;

      const [added] = await tx
        .insert(logisticsShipmentItems)
        .values({
          ...copy,
          cases: add.cases,
          bottlesPerCase: add.bottlesPerCase,
          totalBottles: addBottles,
          lwin: withLwinPack(item.lwin, add.bottlesPerCase),
          ...amounts.add,
        })
        .returning();

      if (!added) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The new line was not created' });
      }

      /*
        Renumbered rather than shifted. Lines added by hand all carry sort
        order 0, so "everything after this one, plus one" has no single
        meaning; a fresh 1..n with the new line under its source does.
      */
      const lines = await tx
        .select({ id: logisticsShipmentItems.id })
        .from(logisticsShipmentItems)
        .where(eq(logisticsShipmentItems.shipmentId, item.shipmentId))
        .orderBy(asc(logisticsShipmentItems.sortOrder), asc(logisticsShipmentItems.createdAt));

      const ordered = lines.map((line) => line.id).filter((id) => id !== added.id);
      ordered.splice(ordered.indexOf(item.id) + 1, 0, added.id);

      for (const [index, id] of ordered.entries()) {
        await tx
          .update(logisticsShipmentItems)
          .set({ sortOrder: index + 1 })
          .where(eq(logisticsShipmentItems.id, id));
      }

      return { kept, added };
    });

    await recalcShipmentTotals(item.shipmentId);

    return result;
  });

export default adminSplitItemPack;

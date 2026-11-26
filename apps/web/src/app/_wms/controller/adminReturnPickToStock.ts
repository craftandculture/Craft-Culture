import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { RETURN_REASON_CODE } from '@/app/_partnerApi/utils/classifyPartnerMovement';
import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';
import moveBottlesToSingles from '../utils/moveBottlesToSingles';

/** Bottles per case from a dashed LWIN18 (`1010279-2015-06-00750` → 6) */
const packOf = (lwin18: string) => {
  const pack = Number(lwin18.split('-')[2]);
  return Number.isFinite(pack) && pack > 0 ? pack : 1;
};

/** Every return note starts this way, so returns can be totalled per pick */
const returnNotePrefix = (pickMovementNumber: string) => `RETURN of ${pickMovementNumber}`;

/**
 * Put wine back into stock from an order it was picked for
 *
 * A returned or cancelled-after-pick order used to come back as a plain count
 * correction, unconnected to the sale, so an owner (and the partner stock API)
 * saw a sale and an unexplained correction rather than a sale and its return.
 * This records the return against the pick: same order, same owner, same bay.
 *
 * Whole cases go back onto the case row they were picked from. Bottles short of
 * a case go onto the single-bottle row at that bay, the way a cracked case's
 * remainder does. You cannot return more bottles than the pick took, less any
 * returned already.
 *
 * Stock is the only thing changed. The order's status and invoicing are left to
 * the order desk.
 *
 * @example
 *   await trpcClient.wms.admin.stock.returnPickToStock.mutate({
 *     movementId: 'uuid', bottles: 6, reason: 'Client refused delivery',
 *   });
 */
const adminReturnPickToStock = wmsOperatorProcedure
  .input(
    z.object({
      movementId: z.string().uuid(),
      bottles: z.number().int().positive(),
      reason: z.string().trim().min(1, 'Say why it came back'),
    }),
  )
  .mutation(async ({ input, ctx }) =>
    db.transaction(async (tx) => {
      const [pick] = await tx
        .select()
        .from(wmsStockMovements)
        .where(eq(wmsStockMovements.id, input.movementId))
        .for('update');

      if (!pick || pick.movementType !== 'pick') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a pick can be returned to stock' });
      }

      const pickedBottles = Math.abs(pick.quantityBottles ?? pick.quantityCases * packOf(pick.lwin18));
      const prefix = returnNotePrefix(pick.movementNumber);
      const [already] = await tx
        .select({
          bottles: sql<number>`COALESCE(SUM(${wmsStockMovements.quantityBottles}), 0)::int`,
        })
        .from(wmsStockMovements)
        .where(
          and(
            eq(wmsStockMovements.reasonCode, RETURN_REASON_CODE),
            sql`${wmsStockMovements.notes} LIKE ${`${prefix}:%`}`,
          ),
        );
      const returnable = pickedBottles - (already?.bottles ?? 0);

      if (input.bottles > returnable) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${pick.movementNumber} took ${pickedBottles} bottle(s) and ${returnable} can still be returned.`,
        });
      }

      // The row the bottles came off; failing that, the owner's row of this wine
      const [template] = pick.stockId
        ? await tx.select().from(wmsStock).where(eq(wmsStock.id, pick.stockId)).for('update')
        : [];
      const [fallback] = template
        ? [template]
        : pick.fromOwnerId
          ? await tx
              .select()
              .from(wmsStock)
              .where(and(eq(wmsStock.lwin18, pick.lwin18), eq(wmsStock.ownerId, pick.fromOwnerId)))
              .orderBy(desc(wmsStock.updatedAt))
              .limit(1)
              .for('update')
          : [];
      const row = template ?? fallback;

      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No stock record left for this wine and owner to return onto. Add it with Add to stock instead.',
        });
      }

      const pack = row.caseConfig ?? packOf(row.lwin18);
      const wholeCases = pack > 1 ? Math.floor(input.bottles / pack) : input.bottles;
      const loose = pack > 1 ? input.bottles % pack : 0;
      const performedAt = new Date();
      const note = `${prefix}: ${input.reason}`;
      const shared = {
        movementType: 'adjust' as const,
        reasonCode: RETURN_REASON_CODE,
        toLocationId: row.locationId,
        toOwnerId: row.ownerId,
        orderId: pick.orderId,
        lotNumber: row.lotNumber,
        shipmentId: row.shipmentId,
        notes: note,
        performedBy: ctx.user.id,
        performedAt,
      };

      if (wholeCases > 0) {
        await tx
          .update(wmsStock)
          .set({
            quantityCases: sql`${wmsStock.quantityCases} + ${wholeCases}`,
            availableCases: sql`${wmsStock.availableCases} + ${wholeCases}`,
            updatedAt: performedAt,
          })
          .where(eq(wmsStock.id, row.id));

        await tx.insert(wmsStockMovements).values({
          ...shared,
          movementNumber: await generateMovementNumber(tx),
          lwin18: row.lwin18,
          productName: row.productName,
          quantityCases: wholeCases,
          quantityBottles: wholeCases * pack,
          stockId: row.id,
        });
      }

      if (loose > 0) {
        const singlesId = await moveBottlesToSingles({
          sourceStockId: row.id,
          bottles: loose,
          performedBy: ctx.user.id,
          performedAt,
          recordMovement: false,
          db: tx,
        });
        const [singles] = singlesId
          ? await tx.select().from(wmsStock).where(eq(wmsStock.id, singlesId))
          : [];

        if (!singles) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not place the loose bottles on a single-bottle row' });
        }

        await tx.insert(wmsStockMovements).values({
          ...shared,
          movementNumber: await generateMovementNumber(tx),
          lwin18: singles.lwin18,
          productName: singles.productName,
          quantityCases: loose,
          quantityBottles: loose,
          stockId: singles.id,
        });
      }

      return {
        bottles: input.bottles,
        wholeCases,
        loose,
        returnableAfter: returnable - input.bottles,
        pickMovementNumber: pick.movementNumber,
      };
    }),
  );

export default adminReturnPickToStock;

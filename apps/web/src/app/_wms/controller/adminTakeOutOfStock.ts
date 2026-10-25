import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations, wmsStock, wmsStockMovements, wmsStockOutflows } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import STOCK_OUT_REASONS from '../constants/stockOutReasons';
import generateMovementNumber from '../utils/generateMovementNumber';
import moveBottlesToSingles from '../utils/moveBottlesToSingles';
import planStockOut from '../utils/planStockOut';

const reasonKeys = Object.keys(STOCK_OUT_REASONS) as [keyof typeof STOCK_OUT_REASONS, ...(keyof typeof STOCK_OUT_REASONS)[]];

/**
 * Take cases or bottles out of stock, with a reason
 *
 * Replaces lowering a quantity by hand, which made bottles vanish from their
 * owner's statement with no trail. The bottles leave the row (loose bottles
 * first, then a case opened, the rest of it becoming singles, exactly as a
 * split-case pick does), and two records are written: a movement carrying the
 * owner, stock row and bottles, and an outflow saying why and how the owner is
 * settled. Reserved stock cannot be taken.
 *
 * @example
 *   await trpcClient.wms.admin.stock.takeOut.mutate({
 *     stockId, unit: 'bottle', quantity: 2, reason: 'marketing', recipient: 'DIFC tasting',
 *   });
 */
const adminTakeOutOfStock = wmsOperatorProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      unit: z.enum(['case', 'bottle']),
      quantity: z.number().int().positive(),
      reason: z.enum(reasonKeys),
      recipient: z.string().trim().max(200).optional(),
      note: z.string().trim().max(500).optional(),
      unitPriceUsd: z.number().positive().optional(),
      reference: z.string().trim().max(100).optional(),
      backdated: z.boolean().default(false),
      /** The day the bottles actually left (yyyy-mm-dd), when recorded afterwards */
      leftOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const reason = STOCK_OUT_REASONS[input.reason];
    if (reason.needsRecipient && !input.recipient) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Fill in "${reason.detailLabel}".` });
    }
    if (reason.needsPrice && (!input.unitPriceUsd || !input.reference)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sale outside Zoho needs the price per bottle and a reference.' });
    }

    /*
      Recorded afterwards, dated when it happened: midday in Dubai on that
      day, so the timeline and the month's statement put it where it belongs.
    */
    const midday = input.leftOn ? new Date(`${input.leftOn}T12:00:00+04:00`) : null;
    if (midday && midday.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The date it left cannot be in the future.' });
    }
    // Today's date before midday is simply now
    const performedAt = midday && midday.getTime() < Date.now() ? midday : new Date();
    if (Date.now() - performedAt.getTime() > 400 * 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That date is more than a year ago. Ask the office to record it.' });
    }

    return await db.transaction(async (tx) => {
      const [stock] = await tx.select().from(wmsStock).where(eq(wmsStock.id, input.stockId)).for('update');
      if (!stock) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Stock row not found' });
      }

      const pack = stock.caseConfig ?? 12;
      const plan = planStockOut(
        { quantityCases: stock.quantityCases, availableCases: stock.availableCases, openBottles: stock.openBottles, pack },
        input.unit,
        input.quantity,
      );
      if (!plan.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: plan.error });
      }

      const opensCases = input.unit === 'bottle' && pack > 1;
      await tx
        .update(wmsStock)
        .set({
          quantityCases: stock.quantityCases - plan.casesRemoved,
          availableCases: stock.availableCases - plan.casesRemoved,
          // Loose bottles not taken become singles below, the way a pick leaves them
          ...(opensCases ? { openBottles: 0 } : {}),
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, stock.id));

      const leavesSingles = opensCases && plan.leftover > 0;
      const singlesStockId = leavesSingles
        ? await moveBottlesToSingles({ sourceStockId: stock.id, bottles: plan.leftover, performedBy: ctx.user.id, performedAt, db: tx })
        : null;

      // The singles' movement is not yet committed, so the generator cannot see its number
      const movementNumber = await generateMovementNumber(leavesSingles ? 1 : 0);
      const [movement] = await tx
        .insert(wmsStockMovements)
        .values({
          movementNumber,
          movementType: 'adjust',
          lwin18: stock.lwin18,
          productName: stock.productName,
          // Negative, like every other removal: the ledger tools sum adjustments as signed
          quantityCases: -plan.casesRemoved,
          quantityBottles: -plan.bottlesOut,
          fromLocationId: stock.locationId,
          fromOwnerId: stock.ownerId,
          stockId: stock.id,
          reasonCode: `stock_out:${input.reason}`,
          notes: [reason.label, input.recipient, input.note].filter(Boolean).join(' · '),
          performedBy: ctx.user.id,
          performedAt,
        })
        .returning({ id: wmsStockMovements.id });

      if (!movement) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not record the movement' });
      }

      await tx.insert(wmsStockOutflows).values({
        movementId: movement.id,
        stockId: stock.id,
        ownerId: stock.ownerId,
        lwin18: stock.lwin18,
        productName: stock.productName,
        bottles: plan.bottlesOut,
        reason: input.reason,
        settlement: reason.settlement,
        recipient: input.recipient ?? null,
        note: input.note ?? null,
        unitPriceUsd: input.unitPriceUsd ?? null,
        reference: input.reference ?? null,
        backdated: input.backdated || !!input.leftOn,
        performedBy: ctx.user.id,
        performedAt,
      });

      /*
        The bottles left behind are still in the box they came from, wearing
        its old label; the panel offers the relabel the pick screen does.
      */
      const [singles] = singlesStockId
        ? await tx
            .select({
              stockId: wmsStock.id,
              lwin18: wmsStock.lwin18,
              productName: wmsStock.productName,
              bottles: sql<number>`(${wmsStock.quantityCases} * COALESCE(${wmsStock.caseConfig}, 1)) + COALESCE(${wmsStock.openBottles}, 0)`,
              locationCode: wmsLocations.locationCode,
            })
            .from(wmsStock)
            .leftJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(eq(wmsStock.id, singlesStockId))
        : [];

      return {
        movementNumber,
        remainder: singles ?? null,
        bottles: plan.bottlesOut,
        ownerName: stock.ownerName,
        ownerSees: reason.ownerSees,
      };
    });
  });

export default adminTakeOutOfStock;

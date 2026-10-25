import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock, wmsStockMovements, wmsStockOutflows } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import STOCK_OUT_REASONS from '../constants/stockOutReasons';
import type { StockOutReason } from '../constants/stockOutReasons';

const reasonKeys = Object.keys(STOCK_OUT_REASONS) as [StockOutReason, ...StockOutReason[]];

/**
 * Bottles a correction removed, read from the movement itself
 *
 * A pack fix records "bottles 3 → 2" in its note (adminCorrectPackConfig
 * writes it in that form); a count correction records its cases.
 */
const bottlesRemoved = (movement: {
  movementType: string;
  reasonCode: string | null;
  notes: string | null;
  lwin18: string;
  quantityCases: number;
  quantityBottles: number | null;
}) => {
  if (movement.reasonCode === 'pack_correction') {
    const match = movement.notes?.match(/bottles (\d+) → (\d+)\)/);
    if (!match) return 0;
    return Math.max(0, Number(match[1]) - Number(match[2]));
  }
  if (movement.movementType === 'count' && movement.quantityCases < 0) {
    const pack = Number(movement.lwin18.split('-')[2]) || 1;
    return Math.abs(movement.quantityBottles ?? movement.quantityCases * pack);
  }
  return 0;
};

/**
 * Record bottles that a stock correction removed as the take-out they were
 *
 * Before Take out existed, bottles that left were often written off with a
 * pack fix or a count correction: the stock came out right, but the owner's
 * timeline showed "stock corrected" instead of what happened. This turns that
 * record into a take-out with its reason, who it went to and the day it left.
 * **Stock is not changed again**; it was already corrected. The note keeps
 * what the record said before.
 *
 * @example
 *   await trpcClient.wms.admin.stock.recordCorrectionAsTakeOut.mutate({
 *     movementId, reason: 'collected_by_owner', recipient: 'Delivered home', leftOn: '2026-09-09',
 *   });
 */
const adminRecordCorrectionAsTakeOut = wmsOperatorProcedure
  .input(
    z.object({
      movementId: z.string().uuid(),
      reason: z.enum(reasonKeys),
      recipient: z.string().trim().max(200).optional(),
      leftOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const rule = STOCK_OUT_REASONS[input.reason];
    if (rule.needsPrice) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sale outside Zoho needs a price; record it with Take out instead.' });
    }
    if (rule.needsRecipient && !input.recipient) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Fill in "${rule.detailLabel}".` });
    }

    const [movement] = await db
      .select()
      .from(wmsStockMovements)
      .where(eq(wmsStockMovements.id, input.movementId));
    if (!movement) throw new TRPCError({ code: 'NOT_FOUND', message: 'Movement not found' });

    const bottles = bottlesRemoved(movement);
    if (bottles <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only a pack fix or count correction that removed bottles can be recorded as a take-out.',
      });
    }
    const midday = new Date(`${input.leftOn}T12:00:00+04:00`);
    if (midday.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The date it left cannot be in the future.' });
    }
    const leftAt = midday.getTime() < Date.now() ? midday : new Date();
    const by = ctx.user.name ?? ctx.user.email;

    // The row the correction was made on, and its owner; older corrections recorded neither
    const locationId = movement.fromLocationId ?? movement.toLocationId;
    const movementOwner = movement.fromOwnerId ?? movement.toOwnerId;
    const [row] = await db
      .select({ id: wmsStock.id, ownerId: wmsStock.ownerId })
      .from(wmsStock)
      .where(
        movement.stockId
          ? eq(wmsStock.id, movement.stockId)
          : and(
              eq(wmsStock.lwin18, movement.lwin18),
              movementOwner ? eq(wmsStock.ownerId, movementOwner) : undefined,
              locationId ? eq(wmsStock.locationId, locationId) : undefined,
            ),
      )
      .limit(1);
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'The stock row this correction was made on is no longer there.' });
    }
    const ownerId = movementOwner ?? row.ownerId;

    await db.transaction(async (tx) => {
      await tx
        .update(wmsStockMovements)
        .set({
          reasonCode: `stock_out:${input.reason}`,
          fromOwnerId: ownerId,
          fromLocationId: locationId,
          stockId: row.id,
          quantityBottles: -bottles,
          performedAt: leftAt,
          notes: [
            [rule.label, input.recipient].filter(Boolean).join(' · '),
            `Recorded as a take-out by ${by} on ${new Date().toISOString().slice(0, 10)}; stock had already been corrected`,
            movement.notes ? `Before: ${movement.notes}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          updatedAt: new Date(),
        })
        .where(eq(wmsStockMovements.id, movement.id));

      await tx.insert(wmsStockOutflows).values({
        movementId: movement.id,
        stockId: row.id,
        ownerId,
        lwin18: movement.lwin18,
        productName: movement.productName,
        bottles,
        reason: input.reason,
        settlement: rule.settlement,
        recipient: input.recipient ?? null,
        note: 'Recorded from an earlier stock correction',
        backdated: true,
        performedBy: ctx.user.id,
        performedAt: leftAt,
      });
    });

    return { bottles, ownerSees: rule.ownerSees, label: rule.label };
  });

export default adminRecordCorrectionAsTakeOut;

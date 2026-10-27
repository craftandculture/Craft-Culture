import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStockMovements, wmsStockOutflows } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import STOCK_OUT_REASONS from '../constants/stockOutReasons';
import type { StockOutReason } from '../constants/stockOutReasons';

const reasonKeys = Object.keys(STOCK_OUT_REASONS) as [StockOutReason, ...StockOutReason[]];

/** How long a take-out's reason can still be corrected */
const CORRECTABLE_DAYS = 31;

/**
 * Correct the reason recorded on a take-out
 *
 * The bottles really left, so the quantity stands; only why changes. Picking
 * "Breakage" for bottles taken as samples tells the owner "Damaged in our
 * care" instead of "Sold". The movement and the outflow record both change,
 * and the movement's note keeps what it said before and who changed it.
 *
 * @example
 *   await trpcClient.wms.admin.stock.changeTakeOutReason.mutate({
 *     movementId,
 *     reason: 'samples',
 *     recipient: 'Kevin Bradford',
 *   });
 */
const adminChangeTakeOutReason = wmsOperatorProcedure
  .input(
    z.object({
      movementId: z.string().uuid(),
      reason: z.enum(reasonKeys),
      recipient: z.string().trim().max(200).optional(),
      unitPriceUsd: z.number().positive().optional(),
      reference: z.string().trim().max(100).optional(),
      /** Correct the day it left (yyyy-mm-dd) */
      leftOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const rule = STOCK_OUT_REASONS[input.reason];
    // Only the date changing: the reason and its detail stand as recorded
    const dateOnly = !!input.leftOn && !input.recipient;
    if (rule.needsRecipient && !input.recipient && !dateOnly) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Fill in "${rule.detailLabel}".` });
    }
    if (rule.needsPrice && (!input.unitPriceUsd || !input.reference)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sale outside Zoho needs the price per bottle and a reference.' });
    }

    const [movement] = await db
      .select({
        id: wmsStockMovements.id,
        reasonCode: wmsStockMovements.reasonCode,
        notes: wmsStockMovements.notes,
        performedAt: wmsStockMovements.performedAt,
      })
      .from(wmsStockMovements)
      .where(eq(wmsStockMovements.id, input.movementId));

    if (!movement?.reasonCode?.startsWith('stock_out:')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a take-out can have its reason changed.' });
    }
    if (Date.now() - movement.performedAt.getTime() > CORRECTABLE_DAYS * 24 * 60 * 60 * 1000) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `This take-out is more than ${CORRECTABLE_DAYS} days old and may already be on a statement. Ask the office to correct it.`,
      });
    }

    const midday = input.leftOn ? new Date(`${input.leftOn}T12:00:00+04:00`) : null;
    if (midday && midday.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The date it left cannot be in the future.' });
    }
    const leftAt = midday ? (midday.getTime() < Date.now() ? midday : new Date()) : null;

    const was = STOCK_OUT_REASONS[movement.reasonCode.slice('stock_out:'.length) as StockOutReason];
    const when = new Date().toISOString().slice(0, 10);
    const notes = [
      dateOnly ? null : [rule.label, input.recipient].filter(Boolean).join(' · '),
      `${input.reason !== movement.reasonCode.slice('stock_out:'.length) ? `Reason changed from ${was?.label ?? movement.reasonCode}` : 'Corrected'}${leftAt ? `, dated ${input.leftOn} (was ${movement.performedAt.toISOString().slice(0, 10)})` : ''} by ${ctx.user.name ?? ctx.user.email} on ${when}`,
      movement.notes ? `Before: ${movement.notes}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    await db.transaction(async (tx) => {
      await tx
        .update(wmsStockMovements)
        .set({
          reasonCode: `stock_out:${input.reason}`,
          notes,
          ...(leftAt ? { performedAt: leftAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(wmsStockMovements.id, movement.id));
      await tx
        .update(wmsStockOutflows)
        .set({
          reason: input.reason,
          settlement: rule.settlement,
          ...(dateOnly ? {} : { recipient: input.recipient ?? null }),
          unitPriceUsd: rule.needsPrice ? (input.unitPriceUsd ?? null) : null,
          reference: rule.needsPrice ? (input.reference ?? null) : null,
          ...(leftAt ? { performedAt: leftAt, backdated: true } : {}),
        })
        .where(eq(wmsStockOutflows.movementId, movement.id));
    });

    return { ownerSees: rule.ownerSees, label: rule.label };
  });

export default adminChangeTakeOutReason;

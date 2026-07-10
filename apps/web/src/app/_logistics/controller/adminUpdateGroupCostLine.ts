import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsGroupCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateGroupCostLineSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Update a group cost line. Recomputes the USD amount when amount or FX change.
 */
const adminUpdateGroupCostLine = adminProcedure
  .input(updateGroupCostLineSchema)
  .mutation(async ({ input }) => {
    const { id, amount, fxToUsd, invoiceDate, ...rest } = input;

    const [existing] = await db
      .select()
      .from(logisticsGroupCostLines)
      .where(eq(logisticsGroupCostLines.id, id));

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Cost line not found' });
    }

    const nextAmount = amount ?? existing.amount;
    const nextFx = fxToUsd ?? existing.fxToUsd;

    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );

    const [line] = await db
      .update(logisticsGroupCostLines)
      .set({
        ...updates,
        ...(amount !== undefined ? { amount } : {}),
        ...(fxToUsd !== undefined ? { fxToUsd } : {}),
        ...(amount !== undefined || fxToUsd !== undefined
          ? { amountUsd: Math.round(nextAmount * nextFx * 100) / 100 }
          : {}),
        ...(invoiceDate !== undefined
          ? { invoiceDate: invoiceDate ? new Date(invoiceDate) : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(logisticsGroupCostLines.id, id))
      .returning();

    return line;
  });

export default adminUpdateGroupCostLine;

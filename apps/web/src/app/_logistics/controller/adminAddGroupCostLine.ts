import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { logisticsGroupCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { addGroupCostLineSchema } from '../schemas/shipmentGroupSchemas';
import recalcGroupLandedCost from '../utils/recalcGroupLandedCost';

/**
 * Add a logistics cost line (invoice charge) to a group. The USD amount is
 * locked in from the FX rate supplied at entry time. Landed cost is re-allocated
 * across the group immediately so late invoices flow straight into pricing.
 */
const adminAddGroupCostLine = adminProcedure
  .input(addGroupCostLineSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { amount, fxToUsd, invoiceDate, ...rest } = input;

    const [line] = await db
      .insert(logisticsGroupCostLines)
      .values({
        ...rest,
        amount,
        fxToUsd,
        amountUsd: Math.round(amount * fxToUsd * 100) / 100,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        createdBy: user.id,
      })
      .returning();

    if (!line) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add cost line' });
    }

    // Re-allocate landed cost across the group so pricing reflects it live.
    try {
      await recalcGroupLandedCost(line.groupId);
    } catch (error) {
      console.error('Failed to re-allocate landed cost after adding cost line', {
        error,
        groupId: line.groupId,
      });
    }

    return line;
  });

export default adminAddGroupCostLine;

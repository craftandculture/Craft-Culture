import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { logisticsGroupCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { addGroupCostLineSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Add a logistics cost line (invoice charge) to a group. The USD amount is
 * locked in from the FX rate supplied at entry time.
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

    return line;
  });

export default adminAddGroupCostLine;

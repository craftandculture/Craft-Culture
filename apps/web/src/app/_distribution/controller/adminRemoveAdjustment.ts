import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import assertMonthOpen from '../utils/assertMonthOpen';

/**
 * Remove an adjustment from a month that has not been approved
 *
 * @param id - The adjustment
 * @returns Whether it was removed
 */
const adminRemoveAdjustment = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const [row] = await client<{ outletId: string; month: string }[]>`
      SELECT outlet_id AS "outletId", month FROM cons_adjustments WHERE id = ${input.id}
    `;

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No such adjustment' });
    }

    await assertMonthOpen(row.outletId, row.month);

    await client`DELETE FROM cons_adjustments WHERE id = ${input.id}`;

    return { removed: true };
  });

export default adminRemoveAdjustment;

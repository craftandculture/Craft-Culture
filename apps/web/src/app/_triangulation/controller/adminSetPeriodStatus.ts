import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updatePeriodStatusSchema } from '../schemas/triangulationSchemas';

/**
 * Lock or reopen a reporting period
 *
 * Locking records who signed the period off and blocks further imports being
 * attached to it, so an agreed reconciliation cannot drift after the fact.
 */
const adminSetPeriodStatus = adminProcedure
  .input(updatePeriodStatusSchema)
  .mutation(async ({ input, ctx }) => {
    const { periodId, status } = input;

    // The time is taken in SQL rather than bound as a JS Date, which the
    // raw client does not reliably serialise (the lock could fail to save).
    const locking = status === 'locked';

    const updated = await client<{ id: string }[]>`
      UPDATE tri_periods
      SET status = ${status},
          locked_at = ${locking ? client`NOW()` : client`NULL`},
          locked_by = ${locking ? ctx.user.id : null},
          updated_at = NOW()
      WHERE id = ${periodId}
      RETURNING id
    `;

    if (updated.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });
    }

    return { periodId, status };
  });

export default adminSetPeriodStatus;

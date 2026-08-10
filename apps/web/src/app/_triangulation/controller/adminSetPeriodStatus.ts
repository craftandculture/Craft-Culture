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

    await client`
      UPDATE tri_periods
      SET status = ${status},
          locked_at = ${status === 'locked' ? new Date() : null},
          locked_by = ${status === 'locked' ? ctx.user.id : null},
          updated_at = NOW()
      WHERE id = ${periodId}
    `;

    return { periodId, status };
  });

export default adminSetPeriodStatus;

import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createPeriodSchema } from '../schemas/triangulationSchemas';

/**
 * Create a reporting period, normally one calendar month
 *
 * Imports are attached to a period so a month can be signed off and locked
 * without later uploads disturbing it.
 */
const adminCreatePeriod = adminProcedure
  .input(createPeriodSchema)
  .mutation(async ({ input }) => {
    const { label, periodStart, periodEnd, notes } = input;

    if (periodEnd < periodStart) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Period end must fall on or after the period start',
      });
    }

    const [existing] = await client<{ id: string }[]>`
      SELECT id FROM tri_periods WHERE label = ${label} LIMIT 1
    `;

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `A period labelled "${label}" already exists`,
      });
    }

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_periods (label, period_start, period_end, notes)
      VALUES (${label}, ${periodStart}, ${periodEnd}, ${notes ?? null})
      RETURNING id
    `;

    return { id: created?.id ?? '', label };
  });

export default adminCreatePeriod;

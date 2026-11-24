import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import paidOnReady from '../utils/paidOnReady';

/**
 * Set when an owner's City Drinks consignment is paid
 *
 * 'sale' pays the owner when City Drinks sell the bottle, which is most
 * owners. 'dispatch' pays them when it goes out to City Drinks, so the
 * consignment invoice is owed in its own month on the partner statements and
 * the later sale owes them nothing more (Strasky and Alain: Sophie, 24 Nov
 * 2026).
 *
 * @param ownerId - The consignment owner
 * @param paidOn - 'sale' or 'dispatch'
 * @returns The owner and its setting
 */
const adminSetOwnerPaidOn = adminProcedure
  .input(z.object({ ownerId: z.string().uuid(), paidOn: z.enum(['sale', 'dispatch']) }))
  .mutation(async ({ input }) => {
    if (!(await paidOnReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'The setting is not in the database yet: the latest deploy’s migration has not run.',
      });
    }

    const [row] = await client<{ id: string }[]>`
      UPDATE cons_owners SET consignment_paid_on = ${input.paidOn}, updated_at = now()
      WHERE id = ${input.ownerId}
      RETURNING id
    `;

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });
    }

    return input;
  });

export default adminSetOwnerPaidOn;

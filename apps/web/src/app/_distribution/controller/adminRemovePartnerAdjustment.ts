import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Take a one-off line off a partner's statement
 *
 * @param id - The line
 * @returns Whether a line was removed
 */
const adminRemovePartnerAdjustment = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const result = await client`DELETE FROM cons_partner_adjustments WHERE id = ${input.id}`;

    return { removed: result.count > 0 };
  });

export default adminRemovePartnerAdjustment;

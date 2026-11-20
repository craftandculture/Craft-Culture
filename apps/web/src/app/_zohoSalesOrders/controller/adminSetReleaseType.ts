import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import tableReady from '@/app/_distribution/utils/tableReady';
import { adminProcedure } from '@/lib/trpc/procedures';

import { RELEASE_TYPES } from '../utils/resolveReleaseType';

/**
 * Say what a sales order is being released as
 *
 * Consignment, outright sale, private client order or prepaid by the outlet.
 * The invoice and the Distribution page take it from here. Set by the office,
 * not the warehouse login, since it decides who is paid.
 *
 * @param salesOrderId - Our sales order
 * @param releaseType - The type
 * @returns Confirmation
 */
const adminSetReleaseType = adminProcedure
  .input(
    z.object({
      salesOrderId: z.string().uuid(),
      releaseType: z.enum(RELEASE_TYPES),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await tableReady('zoho_so_release_types'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Release types are not available on this database yet.',
      });
    }

    await client`
      INSERT INTO zoho_so_release_types (sales_order_id, release_type, set_by, set_at)
      VALUES (${input.salesOrderId}, ${input.releaseType}, ${ctx.user.id}, now())
      ON CONFLICT (sales_order_id) DO UPDATE SET
        release_type = EXCLUDED.release_type,
        set_by = EXCLUDED.set_by,
        set_at = now()
    `;

    return { releaseType: input.releaseType };
  });

export default adminSetReleaseType;

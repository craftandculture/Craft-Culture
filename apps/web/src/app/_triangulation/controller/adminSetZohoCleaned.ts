import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setZohoCleanedSchema } from '../schemas/triangulationSchemas';

/**
 * Record that a wine's Zoho item master has been put right
 *
 * This cannot be detected. A Zoho sales order line keeps the SKU it was raised
 * under, so correcting an item leaves every existing order reading the old
 * code — which is the right behaviour, and the reason renaming an item does
 * not disturb issued invoices, but it means the reconciliation has no way of
 * seeing the work.
 *
 * Left to infer it, the tab reported seventy wines still to do however many
 * had been finished, which is worse than no progress indicator at all: it
 * invites the same wine to be corrected twice.
 *
 * New invoices will carry the new code and prove it in the ordinary way. This
 * just stops the list lying in the meantime.
 */
const adminSetZohoCleaned = adminProcedure
  .input(setZohoCleanedSchema)
  .mutation(async ({ input }) => {
    const [updated] = await client<{ wCode: string }[]>`
      UPDATE tri_skus
      SET zoho_cleaned_at = ${input.cleaned ? new Date() : null},
          updated_at = NOW()
      WHERE id = ${input.skuId}
      RETURNING w_code AS "wCode"
    `;

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SKU not found' });
    }

    return { wCode: updated.wCode, cleaned: input.cleaned };
  });

export default adminSetZohoCleaned;

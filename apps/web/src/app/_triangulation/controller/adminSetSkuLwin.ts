import { TRPCError } from '@trpc/server';

import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setSkuLwinSchema } from '../schemas/triangulationSchemas';

/**
 * Record the LWIN someone has confirmed for a SKU
 *
 * Stored dashed whatever form it arrives in, because the dashed LWIN is the
 * standard being worked towards and a dashless copy would read as a different
 * code to every comparison downstream — including the one that decides whether
 * a Zoho item is already correct.
 */
const adminSetSkuLwin = adminProcedure
  .input(setSkuLwinSchema)
  .mutation(async ({ input }) => {
    const lwin18 = normalizeLwin18(input.lwin18.trim());

    const [updated] = await client<{ wCode: string }[]>`
      UPDATE tri_skus
      SET lwin18 = ${lwin18}, updated_at = NOW()
      WHERE id = ${input.skuId}
      RETURNING w_code AS "wCode"
    `;

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'SKU not found' });
    }

    return { wCode: updated.wCode, lwin18 };
  });

export default adminSetSkuLwin;

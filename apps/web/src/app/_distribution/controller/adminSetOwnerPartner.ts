import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Link a consignment owner to the partner account it is
 *
 * The distribution ledger keeps its own owner list (CC, CRU, CRURATED…) and
 * the warehouse keys stock to partners. Until the two are joined, an owner's
 * consignment sales cannot be shown in its portal or on its statement, so the
 * link is one key, set once here.
 *
 * @param ownerId - The consignment owner
 * @param partnerId - Its partner account, or null to unlink
 * @returns The owner and partner linked
 */
const adminSetOwnerPartner = adminProcedure
  .input(z.object({ ownerId: z.string().uuid(), partnerId: z.string().uuid().nullable() }))
  .mutation(async ({ input }) => {
    if (input.partnerId) {
      const [taken] = await client<{ name: string }[]>`
        SELECT name FROM cons_owners WHERE partner_id = ${input.partnerId} AND id <> ${input.ownerId} LIMIT 1
      `;
      if (taken) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `That account is already linked to ${taken.name}. One account, one owner.`,
        });
      }
    }

    const [row] = await client<{ id: string }[]>`
      UPDATE cons_owners SET partner_id = ${input.partnerId}, updated_at = now()
      WHERE id = ${input.ownerId}
      RETURNING id
    `;
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });
    }
    return { ownerId: input.ownerId, partnerId: input.partnerId };
  });

export default adminSetOwnerPartner;

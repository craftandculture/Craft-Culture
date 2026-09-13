import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerIdentityDocuments } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Remove an identity document a member has uploaded
 *
 * Scoped to the caller's own partner, so the worst a tampered request can do
 * is delete something the caller already owns.
 */
const memberDeleteIdentityDocument = stockOwnerProcedure
  .input(z.object({ documentType: z.string().max(60) }))
  .mutation(async ({ ctx, input }) => {
    await db
      .delete(partnerIdentityDocuments)
      .where(
        and(
          eq(partnerIdentityDocuments.partnerId, ctx.partner.id),
          eq(partnerIdentityDocuments.documentType, input.documentType),
        ),
      );

    return { deleted: true };
  });

export default memberDeleteIdentityDocument;

import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarAccessGrants, partnerMembers } from '@/database/schema';
import { cellarHolderProcedure } from '@/lib/trpc/procedures';

/**
 * Change how much someone the cellar is shared with can do
 *
 * Holder only, and only for this holder's own cellar. Takes effect on the
 * person's next request, since the role is read from the grant every time.
 */
const memberChangeAccess = cellarHolderProcedure
  .input(
    z.object({
      grantId: z.string().uuid(),
      role: z.enum(['viewer', 'manager']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [grant] = await db
      .update(cellarAccessGrants)
      .set({ role: input.role })
      .where(
        and(
          eq(cellarAccessGrants.id, input.grantId),
          eq(cellarAccessGrants.partnerId, ctx.partner.id),
          inArray(cellarAccessGrants.status, ['invited', 'active']),
        ),
      )
      .returning();

    if (!grant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That person no longer has access. Please refresh.',
      });
    }

    /* Kept in step for the screens that read partner_members.role */
    if (grant.userId) {
      await db
        .update(partnerMembers)
        .set({ role: input.role === 'manager' ? 'member' : 'viewer' })
        .where(
          and(
            eq(partnerMembers.partnerId, ctx.partner.id),
            eq(partnerMembers.userId, grant.userId),
          ),
        );
    }

    return { role: grant.role };
  });

export default memberChangeAccess;

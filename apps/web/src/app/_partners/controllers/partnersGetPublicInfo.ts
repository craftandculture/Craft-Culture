import { and, eq, or, sql } from 'drizzle-orm';
import z from 'zod';

import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { partnerMembers, partners, quotes } from '@/database/schema';
import { approvedProcedure } from '@/lib/trpc/procedures';

/**
 * Get public display info for a partner
 *
 * Used by clients to display partner branding on quotes.
 * Only returns non-sensitive information suitable for public display.
 *
 * Limited to partners the caller has a relationship with — staff, someone
 * linked to the partner, or a client holding a quote licensed through it — so
 * an approved login cannot walk partner ids to list who C&C works with.
 */
const partnersGetPublicInfo = approvedProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    const { partnerId } = input;
    const userId = ctx.user.id;

    if (!isTeamMember(ctx.user) && ctx.user.partnerId !== partnerId) {
      const [related] = await db
        .select({ one: sql<number>`1` })
        .from(partners)
        .where(
          and(
            eq(partners.id, partnerId),
            or(
              eq(partners.userId, userId),
              sql`EXISTS (SELECT 1 FROM ${partnerMembers} WHERE ${partnerMembers.partnerId} = ${partners.id} AND ${partnerMembers.userId} = ${userId})`,
              sql`EXISTS (SELECT 1 FROM ${quotes} WHERE ${quotes.licensedPartnerId} = ${partners.id} AND ${quotes.userId} = ${userId})`,
            ),
          ),
        )
        .limit(1);

      if (!related) return null;
    }

    const [partner] = await db
      .select({
        id: partners.id,
        businessName: partners.businessName,
        logoUrl: partners.logoUrl,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      return null;
    }

    return partner;
  });

export default partnersGetPublicInfo;

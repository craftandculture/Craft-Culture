import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Get the partner membership for a user
 *
 * Returns the partner the user is linked to via partnerMembers table,
 * or the partner where userId matches (legacy direct link).
 */
const usersGetPartnerMembership = adminProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { userId } = input;

    // Check partnerMembers first
    const membership = await db
      .select({
        id: partnerMembers.id,
        partnerId: partnerMembers.partnerId,
        role: partnerMembers.role,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          type: partners.type,
        },
      })
      .from(partnerMembers)
      .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
      .where(eq(partnerMembers.userId, userId))
      .limit(1);

    if (membership.length > 0 && membership[0]) {
      return {
        type: 'member' as const,
        membership: membership[0],
      };
    }

    // Check direct partner link (legacy)
    const directPartner = await db.query.partners.findFirst({
      where: { userId },
      columns: {
        id: true,
        businessName: true,
        type: true,
      },
    });

    if (directPartner) {
      return {
        type: 'owner' as const,
        partner: directPartner,
      };
    }

    return null;
  });

export default usersGetPartnerMembership;

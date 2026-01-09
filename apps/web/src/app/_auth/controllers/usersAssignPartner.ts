import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  partnerId: z.string().uuid(),
  role: z.enum(['owner', 'member', 'viewer']).default('member'),
});

/**
 * Assign a user to a partner (distributor or wine partner)
 *
 * Creates a partnerMembers record linking the user to the partner.
 * Only replaces existing membership for the same partner type.
 * A user can be assigned to both a distributor AND a wine partner.
 */
const usersAssignPartner = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, partnerId, role } = input;

    // Verify the partner exists and get its type
    const partnerResult = await db
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    const partner = partnerResult[0];

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    // Get all partners of the same type to remove only those memberships
    const sameTypePartners = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.type, partner.type));

    const sameTypePartnerIds = sameTypePartners.map((p) => p.id);

    // Remove existing membership for this user with partners of the same type only
    if (sameTypePartnerIds.length > 0) {
      await db
        .delete(partnerMembers)
        .where(
          and(
            eq(partnerMembers.userId, userId),
            inArray(partnerMembers.partnerId, sameTypePartnerIds),
          ),
        );
    }

    // Create new membership
    const [membership] = await db
      .insert(partnerMembers)
      .values({
        userId,
        partnerId,
        role,
        addedBy: ctx.user.id,
      })
      .returning();

    // Clear legacy user.partnerId field if assigning to a wine partner
    // This ensures partnerMembers is the single source of truth for partner resolution
    if (partner.type === 'wine_partner') {
      await db
        .update(users)
        .set({ partnerId: null })
        .where(eq(users.id, userId));
    }

    return {
      membership,
      partner: {
        id: partner.id,
        businessName: partner.businessName,
        type: partner.type,
      },
    };
  });

export default usersAssignPartner;

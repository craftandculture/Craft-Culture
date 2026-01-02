import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  partnerType: z.enum(['distributor', 'wine_partner']),
});

/**
 * Remove a user from their partner (distributor or wine partner)
 *
 * Deletes the partnerMembers record linking the user to a partner of the specified type.
 * Only removes membership for the specified partner type, preserving other memberships.
 */
const usersRemovePartner = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { userId, partnerType } = input;

    // Get all partners of the specified type
    const partnersOfType = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.type, partnerType));

    const partnerIds = partnersOfType.map((p) => p.id);

    // Remove only memberships for this partner type
    if (partnerIds.length > 0) {
      await db
        .delete(partnerMembers)
        .where(
          and(
            eq(partnerMembers.userId, userId),
            inArray(partnerMembers.partnerId, partnerIds),
          ),
        );
    }

    return { success: true };
  });

export default usersRemovePartner;

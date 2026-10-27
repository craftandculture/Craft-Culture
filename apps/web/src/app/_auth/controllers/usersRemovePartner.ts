import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { isStockOwnerPartnerType } from '@/app/_auth/constants/accessProfiles';
import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  partnerType: z.enum(['distributor', 'wine_partner', 'private_collector']),
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

    // One transaction, so the membership and the legacy link go together
    await db.transaction(async (tx) => {
      // Remove only memberships for this partner type
      await tx
        .delete(partnerMembers)
        .where(
          and(
            eq(partnerMembers.userId, userId),
            inArray(
              partnerMembers.partnerId,
              tx
                .select({ id: partners.id })
                .from(partners)
                .where(eq(partners.type, partnerType)),
            ),
          ),
        );

      // Also clear the legacy user.partnerId field when removing a
      // stock-owning partner, matching what assignment does.
      if (isStockOwnerPartnerType(partnerType)) {
        await tx
          .update(users)
          .set({ partnerId: null })
          .where(eq(users.id, userId));
      }
    });

    return { success: true };
  });

export default usersRemovePartner;

import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { isStockOwnerPartnerType } from '@/app/_auth/constants/accessProfiles';
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

    /*
      One transaction: the old membership is removed and the new one written
      together, so a failure between them can never leave the user linked to
      nothing (or, with the legacy column, to the wrong partner).
    */
    const membership = await db.transaction(async (tx) => {
      // Remove existing membership for this user with partners of the same type only
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
                .where(eq(partners.type, partner.type)),
            ),
          ),
        );

      // Create new membership
      const [created] = await tx
        .insert(partnerMembers)
        .values({
          userId,
          partnerId,
          role,
          addedBy: ctx.user.id,
        })
        .returning();

      // Clear the legacy user.partnerId field for any stock-owning partner, so
      // partnerMembers stays the single source of truth for partner resolution.
      if (isStockOwnerPartnerType(partner.type)) {
        await tx
          .update(users)
          .set({ partnerId: null })
          .where(eq(users.id, userId));
      }

      return created;
    });

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

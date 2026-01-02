import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  partnerId: z.string().uuid(),
  role: z.enum(['owner', 'member', 'viewer']).default('member'),
});

/**
 * Assign a user to a partner (distributor)
 *
 * Creates a partnerMembers record linking the user to the partner.
 * Replaces any existing membership for this user.
 */
const usersAssignPartner = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, partnerId, role } = input;

    // Verify the partner exists
    const partner = await db.query.partners.findFirst({
      where: { id: partnerId },
    });

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    // Remove any existing membership for this user
    await db
      .delete(partnerMembers)
      .where(eq(partnerMembers.userId, userId));

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

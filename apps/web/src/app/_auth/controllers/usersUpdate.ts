import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import updateUserSchema from '../schemas/updateUserSchema';

/**
 * Update user profile during onboarding
 *
 * When a user selects "Wine Partner" (customerType: 'private_clients'),
 * automatically creates a Partner record linked to their account.
 */
const usersUpdate = protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => {
    const { acceptTerms, ...rest } = input;

    // Update the user record
    const [updatedUser] = await db
      .update(users)
      .set({
        ...rest,
        onboardingCompletedAt: new Date(),
        ...(acceptTerms && { termsAcceptedAt: new Date() }),
      })
      .where(eq(users.id, ctx.user.id))
      .returning();

    // Auto-create Partner record for Wine Partners
    if (updatedUser && input.customerType === 'private_clients') {
      // Check if partner record already exists for this user
      const [existingPartner] = await db
        .select({ id: partners.id })
        .from(partners)
        .where(eq(partners.userId, ctx.user.id));

      if (!existingPartner) {
        await db.insert(partners).values({
          userId: ctx.user.id,
          type: 'wine_partner',
          businessName: updatedUser.name ?? ctx.user.email ?? 'Wine Partner',
        });
      }
    }

    return updatedUser ?? null;
  });

export default usersUpdate;

import { eq } from 'drizzle-orm';

import normalisePartnerName from '@/app/_partners/utils/normalisePartnerName';
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
        /*
          A partner already trading under this name is joined, not duplicated.

          This checked only whether the user already had a record, so a business
          long since on file — with its stock, its shipments and its pricing
          margins — got a second, empty one the moment somebody signed in. The
          margins are keyed on the record, so the new one prices at defaults
          while the screen shows the rate as set on the old.
        */
        const name = updatedUser.name ?? ctx.user.email ?? 'Wine Partner';
        const key = normalisePartnerName(name);

        const byName = key
          ? (
              await db
                .select({ id: partners.id, businessName: partners.businessName })
                .from(partners)
            ).find(
              (partner) => normalisePartnerName(partner.businessName) === key,
            )
          : undefined;

        if (byName) {
          // Claim the existing record for this user rather than starting a
          // second one beside it.
          await db
            .update(partners)
            .set({ userId: ctx.user.id })
            .where(eq(partners.id, byName.id));
        } else {
          await db.insert(partners).values({
            userId: ctx.user.id,
            type: 'wine_partner',
            businessName: name,
          });
        }
      }
    }

    return updatedUser ?? null;
  });

export default usersUpdate;

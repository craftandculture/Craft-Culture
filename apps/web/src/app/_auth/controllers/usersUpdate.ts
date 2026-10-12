import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import normalisePartnerName from '@/app/_partners/utils/normalisePartnerName';
import db from '@/database/client';
import { partners, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';


import updateUserSchema from '../schemas/updateUserSchema';

/**
 * Update user profile during onboarding
 *
 * When a user selects "Wine Partner" (customerType: 'private_clients'),
 * automatically creates a Partner record linked to their account — always a new
 * one; an existing partner with the same name is flagged to admins, never claimed.
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
          A new account always gets its own partner record.

          This used to look for a partner already trading under the typed name
          and hand it to the new user — its stock, its shipments, its pricing.
          A name is not proof of identity: anyone typing "Cult Wines" would have
          been given Cult Wines' account on approval. A genuine member of an
          existing business is linked by an admin instead (one dropdown on the
          Users page), and the match is raised so that is not missed.
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

        await db.insert(partners).values({
          userId: ctx.user.id,
          type: 'wine_partner',
          businessName: name,
        });

        if (byName) {
          await createAdminNotifications({
            type: 'new_user_pending',
            title: `Possible match: ${byName.businessName}`,
            message: `${ctx.user.email ?? name} signed up as "${name}", which matches the existing partner "${byName.businessName}". If they genuinely belong to it, link them on the Users page — nothing has been linked automatically.`,
            entityType: 'user',
            entityId: ctx.user.id,
            actionUrl: '/platform/admin/users?filter=pending',
            metadata: { matchedPartnerId: byName.id },
          });
        }
      }
    }

    return updatedUser ?? null;
  });

export default usersUpdate;

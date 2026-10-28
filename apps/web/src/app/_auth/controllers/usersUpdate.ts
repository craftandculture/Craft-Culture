import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import normalisePartnerName from '@/app/_partners/utils/normalisePartnerName';
import db from '@/database/client';
import { partners, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

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

    /*
      The account type is chosen once, at onboarding. Afterwards it decides
      what the account can see, so a login still awaiting approval (or any
      other) cannot switch itself to a different kind — only an admin can.
    */
    if (
      ctx.user.onboardingCompletedAt &&
      rest.customerType !== undefined &&
      rest.customerType !== ctx.user.customerType
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'Your account type has already been set. Please contact us if it needs to change.',
      });
    }

    // Update the user record
    const [updatedUser] = await db
      .update(users)
      .set({
        ...rest,
        onboardingCompletedAt: ctx.user.onboardingCompletedAt ?? new Date(),
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
          A partner already trading under this name is never claimed here.

          Creating a record whenever the user had none gave a business long
          since on file — with its stock, its shipments and its pricing
          margins — a second, empty one the moment somebody signed in. But
          handing the existing record to whoever signs up under the same name
          let any unapproved signup take over that partner. So a name match
          creates nothing: the admins are told, and they link the user through
          the existing Assign Partner action on the user's admin page
          (users.assignPartner, usersAssignPartner.ts). Only a name with no
          match gets a fresh wine partner record.
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
          logger.info(
            'Onboarding user matches an existing partner by name; not linking',
            { userId: ctx.user.id, partnerId: byName.id },
          );

          try {
            await createAdminNotifications({
              type: 'new_user_pending',
              title: 'Signup matches an existing partner',
              message: `${name} (${ctx.user.email}) signed up under the name of an existing partner, ${byName.businessName}. Review and assign the partner manually if this is the same business.`,
              entityType: 'user',
              entityId: ctx.user.id,
              actionUrl: `/platform/admin/users/${ctx.user.id}`,
              metadata: { matchedPartnerId: byName.id },
            });
          } catch (error) {
            logger.error('Failed to notify admins of partner name match:', error);
          }
        } else {
          /*
            A fresh signup is still awaiting approval, so the partner record
            it creates opens nothing until an admin approves the account. A
            login that is already approved (a cellar delegate, a distributor's
            colleague, a user staff created) has no such review ahead of it,
            and an active record would hand it the trade portal on the spot.
            Its record starts inactive, and the admins are asked to review it.
          */
          const alreadyApproved = ctx.user.approvalStatus === 'approved';
          const [created] = await db
            .insert(partners)
            .values({
              userId: ctx.user.id,
              type: 'wine_partner',
              businessName: name,
              ...(alreadyApproved && { status: 'inactive' as const }),
            })
            .returning({ id: partners.id });

          if (alreadyApproved) {
            try {
              await createAdminNotifications({
                type: 'new_user_pending',
                title: 'Approved user set up a wine partner',
                message: `${name} (${ctx.user.email}) chose a wine partner account after approval. The partner record was created inactive; activate it if this business should trade.`,
                entityType: 'user',
                entityId: ctx.user.id,
                actionUrl: `/platform/admin/users/${ctx.user.id}`,
                metadata: { partnerId: created?.id },
              });
            } catch (error) {
              logger.error('Failed to notify admins of a post-approval partner:', error);
            }
          }
        }
      }
    }

    return updatedUser ?? null;
  });

export default usersUpdate;

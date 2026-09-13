import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import getNotificationCategories from '@/app/_notifications/data/getNotificationCategories';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import db from '@/database/client';
import type { User } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get user's notification preferences
 *
 * Narrowed to what this account can actually receive. A private collector has
 * no buy requests, no purchase orders and no RFQs, so offering them fifteen
 * switches for those was telling them the platform does things for them that
 * it does not — and burying the one switch that matters underneath.
 */
const notificationPreferencesGet = protectedProcedure.query(
  async ({ ctx: { user } }) => {
    const userSettings = await db.query.users.findFirst({
      where: { id: user.id },
      columns: {
        notificationPreferences: true,
      },
    });

    const preferences = userSettings?.notificationPreferences as
      | User['notificationPreferences']
      | undefined;

    /*
      The partner has to be resolved before the profile can be: a collector is
      only distinguishable from a sales account by what they are linked to.
    */
    const partner = await resolvePartnerForUser(
      user.id,
      ['wine_partner', 'distributor', 'private_collector'],
      user.partnerId,
    );

    const access = resolveAccessProfile({
      role: user.role,
      customerType: user.customerType,
      partnerType: partner?.type,
    });

    const categories = getNotificationCategories(access.kind);

    // Map categories with enabled state for each type
    const categoriesWithState = categories.map((category) => ({
      ...category,
      types: category.types.map((typeInfo) => ({
        ...typeInfo,
        enabled: !preferences?.disabledTypes?.includes(typeInfo.type),
        adminDisabled:
          preferences?.adminDisabledTypes?.includes(typeInfo.type) ?? false,
      })),
    }));

    return {
      categories: categoriesWithState,
    };
  },
);

export default notificationPreferencesGet;

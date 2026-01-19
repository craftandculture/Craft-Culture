import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';

import db from '@/database/client';
import { notifications, partnerMembers } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getNotificationsSchema from '../schemas/getNotificationsSchema';

/**
 * Get paginated notifications for the current user
 *
 * Filters notifications to only show:
 * - Notifications without a partnerId (general/legacy notifications)
 * - Notifications for partners the user is currently a member of
 *
 * This ensures that when a user switches between partners/distributors,
 * they only see notifications relevant to their current memberships.
 */
const notificationsGetMany = protectedProcedure
  .input(getNotificationsSchema)
  .query(async ({ ctx, input }) => {
    const { limit, cursor, unreadOnly } = input;
    const userId = ctx.user.id;

    // Get the user's current partner memberships
    const userMemberships = await db
      .select({ partnerId: partnerMembers.partnerId })
      .from(partnerMembers)
      .where(eq(partnerMembers.userId, userId));

    const memberPartnerIds = userMemberships.map((m) => m.partnerId);

    // Build conditions:
    // - Must be for this user
    // - Partner context must be null (general) OR in user's current memberships
    // - Optionally filter to unread only
    const conditions = [
      eq(notifications.userId, userId),
      or(
        isNull(notifications.partnerId),
        memberPartnerIds.length > 0
          ? inArray(notifications.partnerId, memberPartnerIds)
          : undefined,
      ),
    ];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const data = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1)
      .offset(cursor);

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, -1) : data;

    return {
      data: items,
      nextCursor: hasMore ? cursor + limit : null,
    };
  });

export default notificationsGetMany;

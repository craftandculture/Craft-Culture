import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { type CellarApplication, cellarInvites } from '@/database/schema';

/**
 * Whether one of our live invitations names this login
 *
 * Invited means exactly that — not merely that the login is approved. Approval
 * is also how a trade or staff login gets in, and treating that as an
 * invitation opened a cellar for anyone approved, with no review. Used by every
 * step that can create the applicant's cellar, so the first one to run
 * (submitting, or uploading an ID) applies the same rule.
 *
 * @param application - The applicant's application
 * @param userId - The signed-in user
 * @returns True when a sent or accepted invite for this user is on the
 *   application
 */
const isInvitedApplicant = async (
  application: CellarApplication,
  userId: string,
) => {
  if (!application.inviteId) return false;

  const [invite] = await db
    .select({ id: cellarInvites.id })
    .from(cellarInvites)
    .where(
      and(
        eq(cellarInvites.id, application.inviteId),
        /* Sent counts too: they may sign in without opening the link. */
        inArray(cellarInvites.status, ['sent', 'accepted']),
        eq(cellarInvites.userId, userId),
      ),
    )
    .limit(1);

  return Boolean(invite);
};

export default isInvitedApplicant;

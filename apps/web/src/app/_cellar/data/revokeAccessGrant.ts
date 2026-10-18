import { and, eq, inArray } from 'drizzle-orm';

import { STOCK_OWNER_PARTNER_TYPES } from '@/app/_auth/constants/accessProfiles';
import createNotification from '@/app/_notifications/utils/createNotification';
import resolvePartnerForUser from '@/app/_partners/data/resolvePartnerForUser';
import db from '@/database/client';
import { cellarAccessGrants, partnerMembers, partners, users } from '@/database/schema';

interface RevokeAccessGrantParams {
  grantId: string;
  /** When given, the grant must belong to this cellar — a holder revoking */
  partnerId?: string;
  /** Who ended it: the holder, the delegate themselves, or staff */
  revokedBy: string;
  /** Whether to tell the person who lost access */
  notifyDelegate: boolean;
}

/**
 * End someone's shared access to a cellar
 *
 * Effective on their very next request: the grant is marked revoked, which
 * the procedure layer refuses outright, and the partner link that let them
 * resolve to the cellar is removed. A login that this grant approved goes
 * back to pending, unless it has reached a cellar some other way since.
 *
 * Conditional on the grant still being live, so revoking twice is harmless.
 *
 * @returns The revoked grant, or null if it was not live (or not this cellar's)
 */
const revokeAccessGrant = async ({
  grantId,
  partnerId,
  revokedBy,
  notifyDelegate,
}: RevokeAccessGrantParams) => {
  const revoked = await db.transaction(async (tx) => {
    const [grant] = await tx
      .update(cellarAccessGrants)
      .set({ status: 'revoked', revokedAt: new Date(), revokedBy })
      .where(
        and(
          eq(cellarAccessGrants.id, grantId),
          inArray(cellarAccessGrants.status, ['invited', 'active']),
          ...(partnerId ? [eq(cellarAccessGrants.partnerId, partnerId)] : []),
        ),
      )
      .returning();

    if (!grant) return null;

    if (grant.userId) {
      await tx
        .delete(partnerMembers)
        .where(
          and(
            eq(partnerMembers.partnerId, grant.partnerId),
            eq(partnerMembers.userId, grant.userId),
          ),
        );
    }

    return grant;
  });

  if (!revoked?.userId) return revoked;

  if (revoked.approvedOnAccept) {
    const stillLinked = await resolvePartnerForUser(revoked.userId, [
      ...STOCK_OWNER_PARTNER_TYPES,
    ]);

    if (!stillLinked) {
      await db
        .update(users)
        .set({ approvalStatus: 'pending' })
        .where(eq(users.id, revoked.userId));
    }
  }

  if (notifyDelegate) {
    const [cellar] = await db
      .select({ name: partners.businessName })
      .from(partners)
      .where(eq(partners.id, revoked.partnerId))
      .limit(1);

    await createNotification({
      userId: revoked.userId,
      type: 'cellar_access_update',
      title: 'Your access to a private cellar has ended',
      message: `You no longer have access to ${cellar?.name ? `${cellar.name}’s private cellar` : 'this private cellar'}.`,
      entityType: 'cellar_access',
    }).catch((error: unknown) => {
      console.error('Failed to tell a delegate their access ended', {
        grantId,
        error,
      });
    });
  }

  return revoked;
};

export default revokeAccessGrant;

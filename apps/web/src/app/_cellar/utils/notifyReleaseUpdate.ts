import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';
import serverConfig from '@/server.config';

export type ReleaseEvent = 'submitted' | 'quoted' | 'revision';

export interface NotifyReleaseUpdateParams {
  event: ReleaseEvent;
  partnerId: string;
  requestNumber: string;
  requestId: string;
  /** The figure the member has to agree, on a quote */
  totalUsd?: number | null;
  /** What we need changed, when sending one back */
  adminNotes?: string | null;
}

/**
 * Tell the right people a release request has moved
 *
 * A quote nobody is told about is a quote nobody accepts. Until this existed a
 * member found out we had priced their delivery by logging in and looking,
 * which meant the wine sat in bond for as long as it took them to wonder.
 *
 * Who is told depends on the direction. A member's own request landing with us
 * is work for the team, so admins hear about it; everything we send back is
 * for the member and everyone their account is shared with.
 *
 * Never throws. A member should not fail to receive a quote, and an admin
 * should not see an error, because a notification could not be written.
 *
 * @example
 *   await notifyReleaseUpdate({
 *     event: 'quoted', partnerId, requestId, requestNumber: 'REL-2026-0003',
 *     totalUsd: 3140,
 *   });
 *
 * @param params - What happened, and to whose request
 */
const notifyReleaseUpdate = async ({
  event,
  partnerId,
  requestNumber,
  requestId,
  totalUsd,
  adminNotes,
}: NotifyReleaseUpdateParams) => {
  try {
    const recipients = await (async () => {
      if (event === 'submitted') {
        const admins = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'admin'));

        return admins.map((admin) => admin.id);
      }

      const [owner] = await db
        .select({ userId: partners.userId })
        .from(partners)
        .where(eq(partners.id, partnerId))
        .limit(1);

      const members = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, partnerId));

      return [
        ...new Set(
          [...members.map((member) => member.userId), owner?.userId].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      ];
    })();

    if (recipients.length === 0) return;

    const [partner] = await db
      .select({ name: partners.businessName })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    const money = (value: number) =>
      `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    const content = {
      submitted: {
        type: 'cellar_release_submitted' as const,
        title: 'Release requested',
        message: `${partner?.name ?? 'A member'} has asked for wine to be brought out of bond on ${requestNumber}.`,
        actionUrl: `${serverConfig.appUrl}/platform/admin/cellar-releases`,
      },
      quoted: {
        type: 'cellar_release_quoted' as const,
        title: 'Your delivery has been priced',
        /*
          The figure is in the message rather than only behind the link. A
          notification that says "we have replied" makes the member open the
          platform to learn one number.
        */
        message: `${requestNumber} comes to ${
          typeof totalUsd === 'number' ? money(totalUsd) : 'a quoted figure'
        }, all in. Nothing moves until you accept it.`,
        actionUrl: `${serverConfig.appUrl}/platform/cellar`,
      },
      revision: {
        type: 'cellar_release_revision' as const,
        title: 'We need a change to your request',
        message:
          adminNotes?.trim() ||
          `We have sent ${requestNumber} back so a change can be made before we price it.`,
        actionUrl: `${serverConfig.appUrl}/platform/cellar`,
      },
    }[event];

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: content.type,
        title: content.title,
        message: content.message,
        entityType: 'cellar_release_request',
        entityId: requestId,
        actionUrl: content.actionUrl,
        metadata: { requestNumber, totalUsd },
      });
    }
  } catch (error) {
    console.error('Failed to notify on release update', {
      requestNumber,
      event,
      error,
    });
  }
};

export default notifyReleaseUpdate;

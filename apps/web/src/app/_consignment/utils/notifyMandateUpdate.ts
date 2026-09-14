import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';
import serverConfig from '@/server.config';

export type MandateEvent = 'offered' | 'listed' | 'sent_back';

export interface NotifyMandateUpdateParams {
  event: MandateEvent;
  ownerId: string;
  ownerName: string;
  mandateId: string;
  mandateNumber: string;
  productName: string;
  bottles: number;
  /** What we asked to be changed, when sending one back */
  adminNotes?: string | null;
}

/**
 * Tell the right people a sale mandate has moved
 *
 * A member offering wine and hearing nothing is the same hole the release flow
 * had before it was fixed: they find out by logging in and looking, and in the
 * meantime wonder whether we received it at all.
 *
 * Direction decides the audience. An offer arriving is work for the team;
 * everything we send back is for the member and anyone their account is shared
 * with.
 *
 * Never throws. An offer should not fail, and an admin should not see an error,
 * because a notification could not be written.
 *
 * @param params - What happened, and to whose mandate
 */
const notifyMandateUpdate = async ({
  event,
  ownerId,
  ownerName,
  mandateId,
  mandateNumber,
  productName,
  bottles,
  adminNotes,
}: NotifyMandateUpdateParams) => {
  try {
    const recipients = await (async () => {
      if (event === 'offered') {
        const admins = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'admin'));

        return admins.map((admin) => admin.id);
      }

      const [owner] = await db
        .select({ userId: partners.userId })
        .from(partners)
        .where(eq(partners.id, ownerId))
        .limit(1);

      const members = await db
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, ownerId));

      return [
        ...new Set(
          [...members.map((member) => member.userId), owner?.userId].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      ];
    })();

    if (recipients.length === 0) return;

    const quantity = `${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}`;

    const content = {
      offered: {
        type: 'mandate_offered' as const,
        title: 'Wine offered for sale',
        message: `${ownerName} has asked us to sell ${quantity} of ${productName} on ${mandateNumber}.`,
        actionUrl: `${serverConfig.appUrl}/platform/admin/consignment`,
      },
      listed: {
        type: 'mandate_listed' as const,
        title: 'Your wine is on our lists',
        message: `${quantity} of ${productName} is now offered to our trade and private clients.`,
        actionUrl: `${serverConfig.appUrl}/platform/cellar/selling`,
      },
      sent_back: {
        type: 'mandate_sent_back' as const,
        title: 'We need a change before we can list it',
        message:
          adminNotes?.trim() ||
          `We have sent ${mandateNumber} back so a change can be made before we list it.`,
        actionUrl: `${serverConfig.appUrl}/platform/cellar/selling`,
      },
    }[event];

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: content.type,
        title: content.title,
        message: content.message,
        entityType: 'sale_mandate',
        entityId: mandateId,
        actionUrl: content.actionUrl,
        metadata: { mandateNumber, productName, bottles },
      });
    }
  } catch (error) {
    console.error('Failed to notify on mandate update', {
      mandateNumber,
      event,
      error,
    });
  }
};

export default notifyMandateUpdate;

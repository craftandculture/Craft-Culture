import getCellarStaffIds from '@/app/_cellar/data/getCellarStaffIds';
import getPartnerUserIds from '@/app/_cellar/data/getPartnerUserIds';
import createNotification from '@/app/_notifications/utils/createNotification';
import serverConfig from '@/server.config';

export type SourcingEvent =
  | 'requested'
  | 'offer_sent'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'closed';

export interface NotifySourcingUpdateParams {
  event: SourcingEvent;
  requestId: string;
  requestNumber: string;
  partnerId: string;
  memberName: string;
  wineName: string;
  /** What we told the member, when we close a request */
  note?: string | null;
}

/**
 * Tell the right side a wine request has moved
 *
 * Requests and responses go to the team; offers and closures go to the
 * member. Never throws.
 *
 * @param params - What happened, to whose request
 */
const notifySourcingUpdate = async ({
  event,
  requestId,
  requestNumber,
  partnerId,
  memberName,
  wineName,
  note,
}: NotifySourcingUpdateParams) => {
  try {
    const forTeam = ['requested', 'accepted', 'declined', 'withdrawn'].includes(
      event,
    );
    const recipients = forTeam
      ? await getCellarStaffIds()
      : await getPartnerUserIds(partnerId);

    if (recipients.length === 0) return;

    const adminUrl = `${serverConfig.appUrl}/platform/admin/cellar-members?tab=requests`;
    const memberUrl = `${serverConfig.appUrl}/platform/cellar/available`;

    const content = {
      requested: {
        title: 'A member asked us to find a wine',
        message: `${memberName} is looking for ${wineName} (${requestNumber}).`,
        actionUrl: adminUrl,
      },
      offer_sent: {
        title: 'We have found your wine',
        message: `${wineName} is ready for you to look at. Accept it to add it to your cellar.`,
        actionUrl: memberUrl,
      },
      accepted: {
        title: 'A member accepted a wine we found',
        message: `${memberName} accepted ${wineName} (${requestNumber}).`,
        actionUrl: adminUrl,
      },
      declined: {
        title: 'A member declined a wine we found',
        message: `${memberName} declined ${wineName} (${requestNumber}).`,
        actionUrl: adminUrl,
      },
      withdrawn: {
        title: 'A member withdrew a wine request',
        message: `${memberName} no longer needs ${wineName} (${requestNumber}).`,
        actionUrl: adminUrl,
      },
      closed: {
        title: `About your request for ${wineName}`,
        message:
          note?.trim() ||
          'We have not been able to find this wine for you. Please contact us if you would like us to keep looking.',
        actionUrl: memberUrl,
      },
    }[event];

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: 'cellar_sourcing_update',
        title: content.title,
        message: content.message,
        entityType: 'cellar_sourcing_request',
        entityId: requestId,
        actionUrl: content.actionUrl,
        metadata: { requestNumber, event },
      });
    }
  } catch (error) {
    console.error('Failed to notify on sourcing update', {
      requestNumber,
      event,
      error,
    });
  }
};

export default notifySourcingUpdate;

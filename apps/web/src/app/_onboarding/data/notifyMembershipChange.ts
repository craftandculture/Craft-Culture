import getPartnerUserIds from '@/app/_cellar/data/getPartnerUserIds';
import createNotification from '@/app/_notifications/utils/createNotification';
import serverConfig from '@/server.config';

/**
 * Tell a member their membership was paused or resumed
 *
 * A pause stops buying, deliveries and sales. A member who is not told finds
 * out by being refused, which is the worst way to learn it. The wording names
 * no fee and no amount owed; the conversation about that is a personal one.
 *
 * Never throws: the status change must stand even if the notice fails.
 *
 * @param partnerId - The member's cellar
 * @param change - Which way the membership moved
 */
const notifyMembershipChange = async (
  partnerId: string,
  change: 'paused' | 'resumed',
) => {
  try {
    const recipients = await getPartnerUserIds(partnerId);

    const content =
      change === 'paused'
        ? {
            title: 'Your private cellar is paused',
            message:
              'Your wine remains safely stored, but new purchases, deliveries and sales are on hold for now. Please contact us and we will arrange the next step with you.',
          }
        : {
            title: 'Your private cellar is open again',
            message:
              'Purchases, deliveries and sales are available again. Thank you.',
          };

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: 'cellar_membership_update',
        title: content.title,
        message: content.message,
        entityType: 'cellar_membership',
        actionUrl: `${serverConfig.appUrl}/platform/cellar`,
        metadata: { change },
      });
    }
  } catch (error) {
    console.error('Failed to notify a membership change', {
      partnerId,
      change,
      error,
    });
  }
};

export default notifyMembershipChange;

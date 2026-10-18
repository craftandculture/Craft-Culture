import createNotification from '@/app/_notifications/utils/createNotification';
import serverConfig from '@/server.config';

import getCellarHolderIds from './getCellarHolderIds';

interface NotifyCellarHolderParams {
  partnerId: string;
  title: string;
  message: string;
  /** Where the notice should take them */
  path?: string;
}

/**
 * Tell a cellar's holder about something to do with shared access
 *
 * A delegate acting, accepting an invitation or leaving. Never throws: the
 * action itself has already happened and must stand if the notice fails.
 *
 * @param params - The cellar and what to say
 */
const notifyCellarHolder = async ({
  partnerId,
  title,
  message,
  path = '/platform/cellar',
}: NotifyCellarHolderParams) => {
  try {
    const holders = await getCellarHolderIds(partnerId);

    for (const userId of holders) {
      await createNotification({
        userId,
        type: 'cellar_access_update',
        title,
        message,
        entityType: 'cellar_access',
        actionUrl: `${serverConfig.appUrl}${path}`,
      });
    }
  } catch (error) {
    console.error('Failed to notify a cellar holder', { partnerId, error });
  }
};

export default notifyCellarHolder;

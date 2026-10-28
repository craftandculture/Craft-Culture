import { TRPCError } from '@trpc/server';

import getCellarRole from '@/app/_cellar/data/getCellarRole';
import type { CellarApplication } from '@/database/schema';

/**
 * Refuse an application change from anyone but the cellar's holder
 *
 * Once an application is attached to a cellar, saving it writes the holder's
 * profile and identity documents onto the cellar itself. Someone the cellar is
 * shared with — a manager, a viewer, or a person whose access has ended — must
 * never be able to do that, so it is checked on every write, not only when the
 * cellar was first found.
 *
 * @param application - The application about to be written
 * @param userId - The signed-in user
 */
const assertApplicationHolder = async (
  application: CellarApplication,
  userId: string,
) => {
  if (!application.partnerId) return;

  const role = await getCellarRole(application.partnerId, userId);

  if (role !== 'holder') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'Only the holder of this private cellar can change its application details.',
    });
  }
};

export default assertApplicationHolder;

import { inArray } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { cellarUkHoldings } from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import advanceUkIntake from './advanceUkIntake';
import getPartnerUserIds from './getPartnerUserIds';

/**
 * Tell a member wine has been placed in their cellar at our UK bond
 *
 * Shared by the team assigning a rotation and an import placing one by the
 * member's reference, so both read the same. The transfer the member asked us
 * for moves on to "Arrived at our UK bond" at the same time. Never throws:
 * the assignment stands whether or not the notice goes.
 *
 * Takes several rotations for one delivery and sends one notice for them all:
 * LCB books each case as its own rotation, and a 193-case delivery assigned
 * together should be one message, not 193.
 *
 * @param params - The rotation (or rotations) and the member it now belongs to
 */
const notifyUkRotationAssigned = async ({
  rotation,
  rotations,
  partnerId,
}: {
  rotation?: string;
  rotations?: string[];
  partnerId: string;
}) => {
  const placed = rotations ?? (rotation ? [rotation] : []);
  if (placed.length === 0) return;

  try {
    await advanceUkIntake(partnerId);

    const lines = await db
      .select({
        brand: cellarUkHoldings.brand,
        description: cellarUkHoldings.description,
        vintage: cellarUkHoldings.vintage,
        totalBottles: cellarUkHoldings.totalBottles,
      })
      .from(cellarUkHoldings)
      .where(inArray(cellarUkHoldings.rotation, placed));

    const bottles = lines.reduce((sum, line) => sum + line.totalBottles, 0);
    const first = lines[0];
    const wine = first
      ? [first.brand && first.brand !== 'NA' ? first.brand : first.description, first.vintage]
          .filter(Boolean)
          .join(' ')
      : 'Your wine';

    for (const userId of await getPartnerUserIds(partnerId)) {
      await createNotification({
        userId,
        type: 'cellar_wine_received',
        title: 'Wine received at our UK bond',
        message: `${wine}${lines.length > 1 ? ` and ${lines.length - 1} more` : ''} (${bottles} ${
          bottles === 1 ? 'bottle' : 'bottles'
        }) is now held for you at London City Bond, Burton.`,
        actionUrl: `${serverConfig.appUrl}/platform/cellar`,
      });
    }
  } catch (error) {
    logger.error('Could not notify a UK rotation assignment', { rotations: placed, error });
  }
};

export default notifyUkRotationAssigned;

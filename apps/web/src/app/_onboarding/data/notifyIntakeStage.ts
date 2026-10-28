import { and, eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, users } from '@/database/schema';
import serverConfig from '@/server.config';

import wineSources from '../constants/wineSources';
import intakeRouteOf from '../utils/intakeRouteOf';
import intakeStagesFor from '../utils/intakeStagesFor';
import sendOnboardingEmail from '../utils/sendOnboardingEmail';

interface NotifyIntakeStageParams {
  partnerId: string;
  source: string;
  holderName: string | null;
  route: string | null;
  stage: string;
}

/**
 * Tell a member their wine has reached a new stage — in the app and by email
 *
 * Shared by the team moving a transfer by hand and a linked shipment moving
 * it, so both read the same to the member.
 *
 * @param params - The member's cellar, where the wine is from, and the stage
 */
const notifyIntakeStage = async ({ partnerId, source, holderName, route, stage }: NotifyIntakeStageParams) => {
  const stages = intakeStagesFor(intakeRouteOf({ route, source }));
  const stageLabel = stages.find((item) => item.value === stage)?.label ?? stage;
  const sourceLabel = wineSources.find((item) => item.value === source)?.label ?? source;

  const owners = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(partnerMembers)
    .innerJoin(users, eq(users.id, partnerMembers.userId))
    .where(and(eq(partnerMembers.partnerId, partnerId), eq(partnerMembers.role, 'owner')));

  await Promise.all(
    owners.map(async (owner) => {
      await createNotification({
        userId: owner.id,
        type: 'status_update',
        title: `Your wine: ${stageLabel}`,
        message: holderName ?? sourceLabel,
        actionUrl: '/platform/cellar',
      }).catch(() => undefined);

      await sendOnboardingEmail('transferUpdate', owner.email, {
        name: owner.name,
        source: sourceLabel,
        holderName: holderName ?? '',
        stage: stageLabel,
        cellarUrl: `${serverConfig.appUrl}/platform/cellar`,
      });
    }),
  );
};

export default notifyIntakeStage;

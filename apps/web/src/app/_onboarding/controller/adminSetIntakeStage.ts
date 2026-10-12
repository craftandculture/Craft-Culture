import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { cellarIntakes, partnerMembers, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';

import intakeStages, { INTAKE_STAGE_VALUES } from '../constants/intakeStages';
import wineSources from '../constants/wineSources';
import sendOnboardingEmail from '../utils/sendOnboardingEmail';

/**
 * Move a transfer to its next stage, and tell the member
 *
 * The member's Incoming card follows the stage. Closing (for a source that
 * came to nothing, or is finished) hides it without a message.
 */
const adminSetIntakeStage = adminProcedure
  .input(
    z.object({
      intakeId: z.string().uuid(),
      stage: z.enum(INTAKE_STAGE_VALUES),
      shipmentId: z.string().uuid().nullable().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [intake] = await db
      .update(cellarIntakes)
      .set({ stage: input.stage, ...(input.shipmentId !== undefined && { shipmentId: input.shipmentId }) })
      .where(eq(cellarIntakes.id, input.intakeId))
      .returning();

    if (!intake) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
    if (input.stage === 'closed' || !intake.partnerId) return { stage: intake.stage };

    const stageLabel = intakeStages.find((stage) => stage.value === input.stage)?.label ?? input.stage;
    const sourceLabel = wineSources.find((source) => source.value === intake.source)?.label ?? intake.source;

    const owners = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(and(eq(partnerMembers.partnerId, intake.partnerId), eq(partnerMembers.role, 'owner')));

    await Promise.all(
      owners.map(async (owner) => {
        await createNotification({
          userId: owner.id,
          type: 'status_update',
          title: `Your wine: ${stageLabel}`,
          message: intake.holderName ?? sourceLabel,
          actionUrl: '/platform/cellar',
        }).catch(() => undefined);

        await sendOnboardingEmail('transferUpdate', owner.email, {
          name: owner.name,
          source: sourceLabel,
          holderName: intake.holderName ?? '',
          stage: stageLabel,
          cellarUrl: `${serverConfig.appUrl}/platform/cellar`,
        });
      }),
    );

    return { stage: intake.stage };
  });

export default adminSetIntakeStage;

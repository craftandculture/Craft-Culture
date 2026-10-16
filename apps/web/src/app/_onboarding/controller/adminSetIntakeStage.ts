import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarIntakes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { INTAKE_STAGE_VALUES } from '../constants/intakeStages';
import notifyIntakeStage from '../data/notifyIntakeStage';

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

    await notifyIntakeStage({
      partnerId: intake.partnerId,
      source: intake.source,
      holderName: intake.holderName,
      stage: input.stage,
    });

    return { stage: intake.stage };
  });

export default adminSetIntakeStage;

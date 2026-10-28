import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarIntakes } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { INTAKE_ROUTE_VALUES } from '../constants/intakeRoutes';

/**
 * Set how a transfer reaches the UAE: via our UK bond, collected by our
 * freight forwarder and exported direct, or an in-bond move within the UAE
 *
 * Only the wording of the member's tracker and the details they pass on
 * change; the stage is kept, so no message is sent.
 *
 * @example
 *   await trpcClient.onboarding.admin.setIntakeRoute.mutate({ intakeId, route: 'forwarder' });
 */
const adminSetIntakeRoute = staffAdminProcedure
  .input(
    z.object({
      intakeId: z.string().uuid(),
      route: z.enum(INTAKE_ROUTE_VALUES),
    }),
  )
  .mutation(async ({ input }) => {
    const [intake] = await db
      .update(cellarIntakes)
      .set({ route: input.route })
      .where(eq(cellarIntakes.id, input.intakeId))
      .returning({ route: cellarIntakes.route });

    if (!intake) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });

    return { route: intake.route };
  });

export default adminSetIntakeRoute;

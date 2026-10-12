import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import { adminProcedure } from '@/lib/trpc/procedures';

import approveCellarApplication from '../data/approveCellarApplication';

/**
 * Approve a Private Cellar application and open the member's cellar
 *
 * See `approveCellarApplication` — the same path the Users page takes.
 */
const adminApproveApplication = adminProcedure
  .input(z.object({ applicationId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const partnerId = await approveCellarApplication(input.applicationId, ctx.user.id);

    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'cellar_application.approved',
      entityType: 'cellar_application',
      entityId: input.applicationId,
      metadata: { partnerId },
    });

    return { partnerId };
  });

export default adminApproveApplication;

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { cellarApplications, users } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import sendOnboardingEmail from '../utils/sendOnboardingEmail';

/**
 * Decline a Private Cellar application
 *
 * The account is marked rejected, so it cannot reach the platform, and the
 * applicant is told — with the reason, if one is given, since it is shown
 * to them on their status page as well.
 */
const adminDeclineApplication = staffAdminProcedure
  .input(
    z.object({
      applicationId: z.string().uuid(),
      reason: z.string().trim().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [row] = await db
      .select({ application: cellarApplications, user: users })
      .from(cellarApplications)
      .innerJoin(users, eq(users.id, cellarApplications.userId))
      .where(eq(cellarApplications.id, input.applicationId))
      .limit(1);

    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
    if (row.application.status === 'approved') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This member is already approved. Suspend them from Partners instead.',
      });
    }

    const reason = input.reason || null;

    await db.transaction(async (tx) => {
      await tx
        .update(cellarApplications)
        .set({
          status: 'declined',
          decidedAt: new Date(),
          decidedBy: ctx.user.id,
          declineReason: reason,
        })
        .where(eq(cellarApplications.id, row.application.id));
      await tx
        .update(users)
        .set({ approvalStatus: 'rejected' })
        .where(eq(users.id, row.user.id));
    });

    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'cellar_application.declined',
      entityType: 'cellar_application',
      entityId: row.application.id,
      metadata: { reason, email: row.user.email },
    });

    await sendOnboardingEmail('applicationDeclined', row.user.email, {
      name: row.application.fullName ?? row.user.name,
      reason: reason ?? '',
    });

    return { declined: true };
  });

export default adminDeclineApplication;

import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { cellarApplications, cellarIntakes, partners, users } from '@/database/schema';
import serverConfig from '@/server.config';

import ensureApplicantCellar from './ensureApplicantCellar';
import openTransferTasks from './openTransferTasks';
import sendOnboardingEmail from '../utils/sendOnboardingEmail';

/**
 * Open a Private Cellar applicant's cellar
 *
 * The one approval, whether pressed on Cellar members or on the Users page —
 * approving the account alone would leave the cellar inactive and the member
 * with nothing to see. Approval is never blocked by gaps in the profile; those
 * are asked for when the member first acts.
 *
 * @param applicationId - The application
 * @param adminId - Who approved it
 * @returns The partner id of the opened cellar
 */
const approveCellarApplication = async (applicationId: string, adminId: string) => {
  const [row] = await db
    .select({ application: cellarApplications, user: users })
    .from(cellarApplications)
    .innerJoin(users, eq(users.id, cellarApplications.userId))
    .where(eq(cellarApplications.id, applicationId))
    .limit(1);

  if (!row) throw new Error('Application not found');
  const { application, user } = row;

  const partnerId = await ensureApplicantCellar({
    application,
    userId: user.id,
    email: user.email,
    status: 'active',
  });

  const now = new Date();
  const wasApproved = application.status === 'approved';

  await db.transaction(async (tx) => {
    await tx.update(partners).set({ status: 'active' }).where(eq(partners.id, partnerId));
    await tx
      .update(users)
      .set({
        approvalStatus: 'approved',
        approvedAt: user.approvedAt ?? now,
        approvedBy: user.approvedBy ?? adminId,
        customerType: 'private_clients',
      })
      .where(eq(users.id, user.id));
    await tx
      .update(cellarApplications)
      .set({ status: 'approved', partnerId, decidedAt: now, decidedBy: adminId, declineReason: null })
      .where(eq(cellarApplications.id, application.id));
  });

  if (wasApproved) return partnerId;

  const name = application.fullName ?? user.name;
  const cellarUrl = `${serverConfig.appUrl}/platform/cellar`;

  await createNotification({
    userId: user.id,
    type: 'status_update',
    title: 'Your cellar is ready',
    message: 'Have a look around — nothing is charged until you first act on your cellar.',
    actionUrl: '/platform/cellar',
  }).catch(() => undefined);

  await sendOnboardingEmail('cellarReady', user.email, { name, cellarUrl });

  const intakes = await db
    .select()
    .from(cellarIntakes)
    .where(eq(cellarIntakes.applicationId, application.id));
  await openTransferTasks({ memberName: name, partnerId, intakes });

  return partnerId;
};

export default approveCellarApplication;

import { inArray } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { users } from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import cellarTeamEmails from '../constants/cellarTeamEmails';
import sendOnboardingEmail from '../utils/sendOnboardingEmail';

interface NotifyCellarTeamParams {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  phone: string | null;
  missing: string[];
  wineSources: string[];
  /** Invited members are approved on submit — the team is told, not asked */
  isInvited: boolean;
}

/**
 * Tell Kevin and Laraine a Private Cellar application has come in
 *
 * In-app and by email. Never throws: a failed notification must not undo the
 * applicant's submission.
 */
const notifyCellarTeamOfApplication = async ({
  applicationId,
  applicantName,
  applicantEmail,
  phone,
  missing,
  wineSources,
  isInvited,
}: NotifyCellarTeamParams) => {
  try {
    const adminUrl = `${serverConfig.appUrl}/platform/admin/cellar-members?tab=applications`;
    const team = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, [...cellarTeamEmails]));

    const title = isInvited
      ? `${applicantName} has joined Private Cellar`
      : `New Private Cellar application — ${applicantName}`;
    const message = [
      applicantEmail,
      missing.length ? `Missing: ${missing.join(', ')}` : 'Profile complete',
      wineSources.length ? `Wine: ${wineSources.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    await Promise.all(
      team.map(async (member) => {
        await createNotification({
          userId: member.id,
          type: 'new_user_pending',
          title,
          message,
          entityType: 'cellar_application',
          entityId: applicationId,
          actionUrl: '/platform/admin/cellar-members?tab=applications',
        });
        await sendOnboardingEmail('newApplicationAdmin', member.email, {
          applicantName,
          applicantEmail,
          phone: phone ?? '—',
          missing: missing.join(', ') || 'Nothing',
          wineSources: wineSources.join(', ') || '—',
          adminUrl,
        });
      }),
    );
  } catch (error) {
    logger.error('Could not notify the cellar team of an application', {
      error,
      applicationId,
    });
  }
};

export default notifyCellarTeamOfApplication;

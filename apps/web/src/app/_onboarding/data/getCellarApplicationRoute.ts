import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarApplications } from '@/database/schema';

/**
 * Where a Private Cellar applicant belongs, if they are one
 *
 * The platform sends anyone unapproved to `/pending-approval` and anyone
 * without onboarding to `/welcome` — both B2B screens. Someone who started a
 * cellar application is sent back to it, or to its status, instead.
 *
 * A draft only counts once a name has been saved: opening the application
 * creates one, and a B2B user who clicked through out of curiosity must not
 * then be trapped there.
 *
 * @param userId - The signed-in user
 * @returns The route to send them to, or null if they have not applied
 */
const getCellarApplicationRoute = async (userId: string) => {
  const [application] = await db
    .select({
      status: cellarApplications.status,
      fullName: cellarApplications.fullName,
    })
    .from(cellarApplications)
    .where(eq(cellarApplications.userId, userId))
    .limit(1);

  if (!application) return null;
  if (application.status === 'draft' && !application.fullName) return null;

  return application.status === 'draft' ? '/join/application' : '/join/status';
};

export default getCellarApplicationRoute;

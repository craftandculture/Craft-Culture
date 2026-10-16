import { desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarApplications } from '@/database/schema';

import { PRIVATE_CELLAR_TERMS_VERSION } from '../constants/privateCellarTerms';

/**
 * Whether a cellar's member has accepted the current Private Cellar terms
 *
 * Read from the cellar's latest application, the one place acceptance is
 * recorded with its version. The activation sheet and the activation itself
 * both ask this, and must get the same answer: the sheet hiding the checkbox
 * while the server refuses, or the reverse, is how billing starts on terms
 * nobody saw.
 *
 * @param partnerId - The member's cellar
 * @returns The latest application, if any, and whether it carries the current version
 */
const getTermsAcceptance = async (partnerId: string) => {
  const [application] = await db
    .select({
      id: cellarApplications.id,
      termsVersion: cellarApplications.termsVersion,
      termsAcceptedAt: cellarApplications.termsAcceptedAt,
    })
    .from(cellarApplications)
    .where(eq(cellarApplications.partnerId, partnerId))
    .orderBy(desc(cellarApplications.createdAt))
    .limit(1);

  return {
    applicationId: application?.id ?? null,
    acceptedCurrent:
      application?.termsAcceptedAt != null &&
      application.termsVersion === PRIVATE_CELLAR_TERMS_VERSION,
  };
};

export default getTermsAcceptance;

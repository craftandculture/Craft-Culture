import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarMemberships, partnerIdentityDocuments, partners } from '@/database/schema';

export type ActivationStep = 'identity' | 'payment';

/**
 * Whether a member may act on their cellar, and if not, what is missing
 *
 * Only cellars opened through the Private Cellar journey carry a membership
 * row. Members from before it have none and are not gated — they were set up
 * by hand under their own arrangements, and blocking them overnight would be
 * a surprise nobody agreed to.
 *
 * @param partnerId - The member's cellar
 * @returns Whether activation is needed, what is missing, and the status
 */
const getActivationState = async (partnerId: string) => {
  const [[membership], [partner], documents] = await Promise.all([
    db.select().from(cellarMemberships).where(eq(cellarMemberships.partnerId, partnerId)).limit(1),
    db.select({ eidNumber: partners.eidNumber }).from(partners).where(eq(partners.id, partnerId)).limit(1),
    db
      .select({ documentType: partnerIdentityDocuments.documentType })
      .from(partnerIdentityDocuments)
      .where(eq(partnerIdentityDocuments.partnerId, partnerId)),
  ]);

  if (!membership) {
    return {
      isGated: false,
      isActivated: true,
      missing: [] as ActivationStep[],
      membership: null,
      documentTypes: [] as string[],
      eidNumber: null,
    };
  }

  const types = documents.map((document) => document.documentType);
  const hasIdentity =
    Boolean(partner?.eidNumber?.trim()) &&
    types.includes('emirates_id_front') &&
    types.includes('emirates_id_back');

  const missing: ActivationStep[] = [];
  if (!hasIdentity) missing.push('identity');
  if (membership.status !== 'active') missing.push('payment');

  return {
    isGated: true,
    isActivated: missing.length === 0,
    missing,
    membership,
    documentTypes: types,
    eidNumber: partner?.eidNumber ?? null,
  };
};

export default getActivationState;

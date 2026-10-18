import { eq } from 'drizzle-orm';

import hashInviteToken from '@/app/_onboarding/utils/hashInviteToken';
import db from '@/database/client';
import { cellarAccessGrants, partners } from '@/database/schema';

/**
 * The shared-access invitation a link refers to, with its cellar's name
 *
 * Returns accepted grants as well, so a person reopening the link after
 * accepting is taken to the cellar rather than told it has expired. Revoked
 * and lapsed invitations come back as null. A missing table reads as null.
 *
 * @param token - The token from the link
 * @returns The grant and the holder's name, or null
 */
const findAccessInvitation = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;

  try {
    const [row] = await db
      .select({ grant: cellarAccessGrants, holderName: partners.businessName })
      .from(cellarAccessGrants)
      .innerJoin(partners, eq(partners.id, cellarAccessGrants.partnerId))
      .where(eq(cellarAccessGrants.tokenHash, hashInviteToken(token)))
      .limit(1);

    if (!row) return null;

    const { grant } = row;

    if (grant.status === 'revoked') return null;
    if (grant.status === 'invited' && grant.expiresAt < new Date()) return null;

    return row;
  } catch (error) {
    console.error('Could not read a cellar access invitation', { error });
    return null;
  }
};

export default findAccessInvitation;

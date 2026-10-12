import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarInvites } from '@/database/schema';

import hashInviteToken from '../utils/hashInviteToken';

/**
 * The invite a token refers to, if it can still be used
 *
 * Sent or already accepted (re-opening the link after joining is harmless), not
 * revoked, not past its expiry.
 *
 * @param token - The token from the invite link
 * @returns The invite, or null
 */
const findLiveInvite = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;

  const [invite] = await db
    .select()
    .from(cellarInvites)
    .where(eq(cellarInvites.tokenHash, hashInviteToken(token)))
    .limit(1);

  if (!invite) return null;
  if (invite.status === 'revoked' || invite.status === 'expired') return null;
  if (invite.status === 'sent' && invite.expiresAt < new Date()) return null;

  return invite;
};

export default findLiveInvite;

import { randomBytes } from 'node:crypto';

import hashInviteToken from './hashInviteToken';

/** How long an invitation link stays usable */
const INVITE_DAYS = 14;

/**
 * A fresh invitation token, its stored hash and when it lapses
 *
 * Only the hash is kept, so the link can be shown once — when it is made —
 * and never read back from the database. Resending makes a new one.
 *
 * @returns The token for the link, its hash, and the expiry
 */
const newInviteToken = () => {
  const token = randomBytes(32).toString('base64url');

  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  };
};

export default newInviteToken;

import { createHash } from 'node:crypto';

/**
 * The stored form of an invite token
 *
 * Only the hash is kept, so a copy of the database cannot be used to accept
 * somebody's invitation. SHA-256 is enough: the token is 32 random bytes, so
 * there is nothing to brute-force.
 *
 * @param token - The token from the invite link
 * @returns Its hex SHA-256
 */
const hashInviteToken = (token: string) =>
  createHash('sha256').update(token.trim()).digest('hex');

export default hashInviteToken;

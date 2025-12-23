import crypto from 'crypto';

/**
 * Hashes an API key using SHA-256
 *
 * @example
 *   const hash = hashApiKey('cc_live_a1b2c3d4e5f6...');
 *
 * @param key - The API key to hash
 * @returns The SHA-256 hash of the key
 */
const hashApiKey = (key: string): string => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

export default hashApiKey;

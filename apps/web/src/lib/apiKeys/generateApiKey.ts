import crypto from 'crypto';

import hashApiKey from './hashApiKey';

interface GeneratedApiKey {
  key: string;
  keyHash: string;
  keyPrefix: string;
}

/**
 * Generates a secure API key with prefix for identification
 *
 * @example
 *   const { key, keyHash, keyPrefix } = generateApiKey();
 *   // key: cc_live_a1b2c3d4e5f6...
 *   // keyHash: sha256 hash of the key
 *   // keyPrefix: cc_live_a1b2 (first 12 chars for display)
 *
 * @param prefix - Optional prefix for the key (default: 'cc_live')
 * @returns Object containing the full key, its hash, and display prefix
 */
const generateApiKey = (prefix: string = 'cc_live'): GeneratedApiKey => {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const key = `${prefix}_${randomBytes}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.substring(0, 12);

  return { key, keyHash, keyPrefix };
};

export default generateApiKey;

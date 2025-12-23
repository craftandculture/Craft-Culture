import crypto from 'crypto';

import hashApiKey from './hashApiKey';

/**
 * Validates an API key against a stored hash using constant-time comparison
 *
 * @example
 *   const isValid = validateApiKeyHash('cc_live_a1b2c3...', storedHash);
 *
 * @param providedKey - The API key provided in the request
 * @param storedHash - The stored SHA-256 hash to compare against
 * @returns True if the key matches the hash, false otherwise
 */
const validateApiKeyHash = (
  providedKey: string,
  storedHash: string,
): boolean => {
  const providedHash = hashApiKey(providedKey);

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  } catch {
    // If buffers have different lengths, they don't match
    return false;
  }
};

export default validateApiKeyHash;

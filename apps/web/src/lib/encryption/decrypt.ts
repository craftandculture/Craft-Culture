import crypto from 'crypto';

/**
 * Decrypts a string that was encrypted using the `encrypt` function.
 *
 * Expects a base64-encoded string containing IV + ciphertext + auth tag. Uses
 * AES-256-GCM for authenticated decryption.
 *
 * @example
 *   const decrypted = decrypt(
 *     'base64-encoded-encrypted-data',
 *     'encryptionKey',
 *   );
 *   // Returns: "sensitive data"
 *
 * @param encryptedBase64 - The base64-encoded encrypted string (output from
 *   `encrypt`)
 * @param encryptionKey - The encryption key to use
 * @returns The decrypted plaintext string
 * @throws Will throw if decryption fails (invalid auth tag, corrupted data, or
 *   wrong key)
 */
const decrypt = (
  encryptedBase64: string,
  encryptionKey: string | Buffer,
): string => {
  if (typeof encryptedBase64 !== 'string') {
    throw new TypeError('Encrypted data must be a string');
  }

  if (!encryptedBase64) {
    throw new Error('Encrypted data cannot be empty');
  }

  if (
    !encryptionKey ||
    (typeof encryptionKey !== 'string' && !Buffer.isBuffer(encryptionKey))
  ) {
    throw new Error(
      'Encryption key is required and must be a string or Buffer',
    );
  }

  if (encryptionKey.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes for AES-256');
  }

  let combined: Buffer;
  try {
    combined = Buffer.from(encryptedBase64, 'base64');
  } catch (error) {
    throw new Error('Invalid base64-encoded encrypted data', { cause: error });
  }

  // Minimum size: 12-byte IV + 16-byte auth tag = 28 bytes
  if (combined.length < 28) {
    throw new Error(
      'Encrypted data is too short (must be at least 28 bytes for IV + auth tag)',
    );
  }

  // Extract components (knowing their sizes)
  const iv = combined.subarray(0, 12); // First 12 bytes
  const authTag = combined.subarray(-16); // Last 16 bytes
  const encrypted = combined.subarray(12, -16); // Everything in between

  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

export default decrypt;

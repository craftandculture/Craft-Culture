import crypto from 'crypto';

/**
 * Encrypts a string using AES-256-GCM authenticated encryption.
 *
 * The output format is a base64-encoded string containing:
 *
 * - 12-byte initialization vector (IV)
 * - Encrypted data
 * - 16-byte authentication tag
 *
 * @example
 *   const encrypted = encrypt('sensitive data', 'encryptionKey');
 *   // Returns: "base64-encoded-encrypted-data"
 *
 * @param text - The plaintext string to encrypt
 * @param encryptionKey - The encryption key to use
 * @returns A base64-encoded string containing IV + ciphertext + auth tag
 */
const encrypt = (text: string, encryptionKey: string | Buffer): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Concatenate IV + encrypted data + auth tag into one buffer
  const combined = Buffer.concat([iv, encrypted, authTag]);

  // Return as single base64 string
  return combined.toString('base64');
};

export default encrypt;

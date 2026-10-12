import { createCipheriv, randomBytes } from 'node:crypto';

import identityEncryptionKey from './identityEncryptionKey';
import identityFileHeader from './identityFileHeader';

/**
 * Encrypt an identity document before it goes to storage
 *
 * AES-256-GCM with a fresh IV per file. Without a key configured the bytes are
 * returned unchanged, with `encrypted: false`, so nothing that uploads today
 * stops working while the key is being set up.
 *
 * @example
 *   const { bytes, encrypted } = encryptIdentityFile(buffer);
 *
 * @param plain - The document as uploaded
 * @returns The bytes to store, and whether they are encrypted
 */
const encryptIdentityFile = (plain: Buffer) => {
  const key = identityEncryptionKey();

  if (!key) return { bytes: plain, encrypted: false };

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);

  return {
    bytes: Buffer.concat([identityFileHeader, iv, cipher.getAuthTag(), body]),
    encrypted: true,
  };
};

export default encryptIdentityFile;

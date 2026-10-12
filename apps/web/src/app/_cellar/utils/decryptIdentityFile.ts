import { createDecipheriv } from 'node:crypto';

import identityEncryptionKey from './identityEncryptionKey';
import identityFileHeader from './identityFileHeader';

/**
 * Read an identity document back from storage
 *
 * A file without the header predates encryption and is returned as it is. An
 * encrypted file with no key to open it throws: serving ciphertext as an image
 * would look like a corrupt upload and send someone chasing the wrong fault.
 *
 * @param stored - The bytes fetched from storage
 * @returns The original document
 */
const decryptIdentityFile = (stored: Buffer) => {
  const headerLength = identityFileHeader.length;

  if (!stored.subarray(0, headerLength).equals(identityFileHeader)) {
    return stored;
  }

  const key = identityEncryptionKey();

  if (!key) {
    throw new Error('Identity document is encrypted but IDENTITY_ENCRYPTION_KEY is not set');
  }

  const iv = stored.subarray(headerLength, headerLength + 12);
  const tag = stored.subarray(headerLength + 12, headerLength + 28);
  const body = stored.subarray(headerLength + 28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]);
};

export default decryptIdentityFile;

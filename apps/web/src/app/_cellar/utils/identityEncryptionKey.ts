import logger from '@/utils/logger';

/**
 * The key identity documents are encrypted with, or null when none is set
 *
 * Read from `IDENTITY_ENCRYPTION_KEY`: 32 random bytes, base64-encoded
 * (`openssl rand -base64 32`). Vercel Blob has no private tier, so the stored
 * file is reachable by anyone holding its URL; encrypting it first is what
 * makes that URL worthless on its own.
 *
 * A missing or malformed key returns null rather than throwing, so uploads keep
 * working exactly as they did before the key existed — the failure is logged
 * loudly instead, and encryption starts the moment the key is set.
 *
 * @returns The 32-byte key, or null
 */
const identityEncryptionKey = () => {
  const raw = process.env.IDENTITY_ENCRYPTION_KEY;

  if (!raw) {
    logger.warn('IDENTITY_ENCRYPTION_KEY is not set — identity documents are stored unencrypted');
    return null;
  }

  const key = Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    logger.error('IDENTITY_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return null;
  }

  return key;
};

export default identityEncryptionKey;

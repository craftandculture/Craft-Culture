import { del, put } from '@vercel/blob';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerIdentityDocuments } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';
import logger from '@/utils/logger';

import encryptIdentityFile from '../utils/encryptIdentityFile';
import identityEncryptionKey from '../utils/identityEncryptionKey';
import identityFileHeader from '../utils/identityFileHeader';

/**
 * Encrypt every identity document stored before encryption existed
 *
 * Each plain document is re-uploaded encrypted, the record pointed at the new
 * file, and only then is the public original deleted — so a failure part-way
 * leaves a document readable, never lost. Already-encrypted files are skipped,
 * which makes the action safe to run more than once.
 *
 * Refuses to run without a key: "encrypting" with no key would re-upload the
 * same plain bytes and delete the original for nothing.
 *
 * @returns Counts of documents encrypted, already encrypted, and failed
 */
const adminEncryptIdentityDocuments = staffAdminProcedure.mutation(async () => {
  if (!identityEncryptionKey()) {
    return {
      encrypted: 0,
      alreadyEncrypted: 0,
      failed: 0,
      message: 'IDENTITY_ENCRYPTION_KEY is not set — nothing was changed.',
    };
  }

  const documents = await db.select().from(partnerIdentityDocuments);
  const result = { encrypted: 0, alreadyEncrypted: 0, failed: 0 };

  for (const document of documents) {
    try {
      if (!isVercelBlobUrl(document.fileUrl)) {
        result.failed += 1;
        continue;
      }

      const response = await fetch(document.fileUrl);

      if (!response.ok) {
        result.failed += 1;
        continue;
      }

      const stored = Buffer.from(await response.arrayBuffer());

      if (stored.subarray(0, identityFileHeader.length).equals(identityFileHeader)) {
        result.alreadyEncrypted += 1;
        continue;
      }

      const { bytes } = encryptIdentityFile(stored);
      const path = new URL(document.fileUrl).pathname.replace(/^\//, '');

      const blob = await put(path, bytes, {
        access: 'public',
        contentType: 'application/octet-stream',
        addRandomSuffix: true,
      });

      await db
        .update(partnerIdentityDocuments)
        .set({ fileUrl: blob.url })
        .where(eq(partnerIdentityDocuments.id, document.id));

      await del(document.fileUrl);
      result.encrypted += 1;
    } catch (error) {
      logger.error('Could not encrypt identity document', {
        error,
        documentId: document.id,
      });
      result.failed += 1;
    }
  }

  return {
    ...result,
    message: `Encrypted ${result.encrypted}; ${result.alreadyEncrypted} already encrypted; ${result.failed} failed.`,
  };
});

export default adminEncryptIdentityDocuments;

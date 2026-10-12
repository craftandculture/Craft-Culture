import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { and, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';

import db from '@/database/client';
import { partnerIdentityDocuments } from '@/database/schema';
import logger from '@/utils/logger';

import encryptIdentityFile from '../utils/encryptIdentityFile';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const MAX_BYTES = 10 * 1024 * 1024;

export type IdentityDocumentType =
  | 'emirates_id_front'
  | 'emirates_id_back'
  | 'passport';

interface StoreIdentityDocumentParams {
  partnerId: string;
  uploadedBy: string;
  documentType: IdentityDocumentType;
  /** A data URL, as the browser's FileReader produces */
  file: string;
  filename: string;
}

/**
 * Store an identity document against a partner, encrypted
 *
 * Shared by the member's cellar profile and the onboarding application, so
 * there is one place that decides what an acceptable ID upload is and how it
 * is stored.
 *
 * The declared MIME type is ignored in favour of sniffing the bytes. A file
 * named .png that is not a PNG is either a mistake or an attempt, and neither
 * should reach storage on the strength of its own claim about itself.
 *
 * Re-uploading a side replaces it. A member correcting a blurred photo should
 * end up with one readable copy, not two of which someone has to guess the
 * newer.
 *
 * @param params - Who it belongs to, which side, and the file
 * @returns The document type stored
 */
const storeIdentityDocument = async ({
  partnerId,
  uploadedBy,
  documentType,
  file,
  filename,
}: StoreIdentityDocumentParams) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.error('BLOB_READ_WRITE_TOKEN is not set');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'File storage is not configured.',
    });
  }

  const base64 = file.split(',')[1];

  if (!base64) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file' });
  }

  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length > MAX_BYTES) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'File must be under 10MB',
    });
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_TYPES.includes(detected.mime)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Upload a PDF, JPEG, PNG or WebP',
    });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

  /*
    Encrypted before it leaves the server. Vercel Blob has no private tier, so
    the stored file is reachable by anyone holding its URL; encrypted, that URL
    is worthless on its own. Reads go through /api/cellar/identity, which
    decrypts for the member or an admin only. The path is foldered and given a
    random suffix as well, so it is not guessable from a member's name.
  */
  const { bytes } = encryptIdentityFile(buffer);

  const blob = await put(
    `identity/${partnerId}/${documentType}/${safeName}`,
    bytes,
    {
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: true,
    },
  );

  await db
    .delete(partnerIdentityDocuments)
    .where(
      and(
        eq(partnerIdentityDocuments.partnerId, partnerId),
        eq(partnerIdentityDocuments.documentType, documentType),
      ),
    );

  await db.insert(partnerIdentityDocuments).values({
    partnerId,
    documentType,
    fileUrl: blob.url,
    fileName: filename.replace(/["\\]/g, ''),
    // The real type, sniffed from the plain bytes — what the reader serves as
    mimeType: detected.mime,
    fileSize: buffer.length,
    uploadedBy,
  });

  return { uploaded: true, documentType };
};

export default storeIdentityDocument;

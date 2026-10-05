import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { fileTypeFromBuffer } from 'file-type';

import db from '@/database/client';
import { logisticsGroupDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { uploadGroupDocumentSchema } from '../schemas/shipmentGroupSchemas';
import readUploadedFile from '../utils/readUploadedFile';

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Upload a document once to a consolidation group (e.g. the AWB or master
 * freight invoice). It's stored a single time in Vercel Blob and shows on the
 * group and on every member shipment's Documents tab.
 */
const adminUploadGroupDocument = adminProcedure
  .input(uploadGroupDocumentSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { groupId, filename, documentType, documentNumber } = input;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'File storage is not configured.',
      });
    }

    const buffer = await readUploadedFile(input);

    const detectedType = await fileTypeFromBuffer(buffer);
    if (!detectedType || !ALLOWED.includes(detectedType.mime)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid file type. Allowed: PDF, JPEG, PNG, GIF, WebP',
      });
    }
    if (buffer.length > 10 * 1024 * 1024) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'File must be under 10MB' });
    }

    // Already in Blob when the browser uploaded it there; stored here otherwise
    const fileUrl =
      input.blobUrl ??
      (
        await put(
          `logistics/groups/${groupId}/${buffer.length}-${filename.length}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          buffer,
          { access: 'public', contentType: detectedType.mime, addRandomSuffix: true },
        )
      ).url;

    const [doc] = await db
      .insert(logisticsGroupDocuments)
      .values({
        groupId,
        documentType,
        documentNumber: documentNumber ?? null,
        fileUrl,
        fileName: filename,
        fileSize: buffer.length,
        mimeType: detectedType.mime,
        uploadedBy: user.id,
      })
      .returning();

    if (!doc) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save document' });
    }

    return doc;
  });

export default adminUploadGroupDocument;

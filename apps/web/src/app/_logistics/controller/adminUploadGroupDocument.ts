import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { fileTypeFromBuffer } from 'file-type';

import db from '@/database/client';
import { logisticsGroupDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { uploadGroupDocumentSchema } from '../schemas/shipmentGroupSchemas';

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Upload a document once to a consolidation group (e.g. the AWB or master
 * freight invoice). It's stored a single time in Vercel Blob and shows on the
 * group and on every member shipment's Documents tab.
 */
const adminUploadGroupDocument = adminProcedure
  .input(uploadGroupDocumentSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { groupId, file, filename, documentType, documentNumber } = input;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'File storage is not configured.',
      });
    }

    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    if (!base64Data) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file format' });
    }
    const buffer = Buffer.from(base64Data, 'base64');

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

    const stamp = `${buffer.length}-${filename.length}`;
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const blob = await put(`logistics/groups/${groupId}/${stamp}-${sanitized}`, buffer, {
      access: 'public',
      contentType: detectedType.mime,
      addRandomSuffix: true,
    });

    const [doc] = await db
      .insert(logisticsGroupDocuments)
      .values({
        groupId,
        documentType,
        documentNumber: documentNumber ?? null,
        fileUrl: blob.url,
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

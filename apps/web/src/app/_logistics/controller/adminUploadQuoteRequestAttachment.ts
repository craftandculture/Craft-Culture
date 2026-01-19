import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuoteRequestAttachments, logisticsQuoteRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

const uploadAttachmentSchema = z.object({
  requestId: z.string().uuid(),
  fileName: z.string().min(1),
  fileData: z.string(), // Base64 encoded file or data URL
  mimeType: z.string().default('application/pdf'),
  description: z.string().optional(),
});

/**
 * Upload an attachment to a quote request
 *
 * Stores the file in Vercel Blob and creates an attachment record.
 */
const adminUploadQuoteRequestAttachment = adminProcedure
  .input(uploadAttachmentSchema)
  .mutation(async ({ input, ctx }) => {
    const { requestId, fileName, fileData, description } = input;

    // Check if Blob token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.error('BLOB_READ_WRITE_TOKEN environment variable is not set');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'File storage is not configured. Please contact support.',
      });
    }

    // Verify request exists
    const [request] = await db
      .select({ id: logisticsQuoteRequests.id })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.id, requestId));

    if (!request) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Quote request not found',
      });
    }

    try {
      // Extract base64 data from data URL if present
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      if (!base64Data) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file format',
        });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Validate actual file content type
      const detectedType = await fileTypeFromBuffer(buffer);
      if (!detectedType || !ALLOWED_DOCUMENT_TYPES.includes(detectedType.mime)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file type. Allowed: PDF, JPEG, PNG',
        });
      }

      // Validate file size (max 10MB)
      const maxSizeBytes = 10 * 1024 * 1024;
      if (buffer.length > maxSizeBytes) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size must be less than 10MB',
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `quote-requests/${requestId}/${timestamp}-${sanitizedFilename}`;

      // Upload to Vercel Blob
      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: detectedType.mime,
      });

      // Create attachment record
      const [attachment] = await db
        .insert(logisticsQuoteRequestAttachments)
        .values({
          requestId,
          fileName,
          fileUrl: blob.url,
          fileSize: buffer.length,
          mimeType: detectedType.mime,
          description: description || null,
          uploadedBy: ctx.user.id,
        })
        .returning();

      logger.info('Uploaded quote request attachment', {
        attachmentId: attachment.id,
        requestId,
        fileName,
        uploadedBy: ctx.user.id,
      });

      return attachment;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('Failed to upload quote request attachment', {
        error,
        requestId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload attachment. Please try again.',
      });
    }
  });

export default adminUploadQuoteRequestAttachment;

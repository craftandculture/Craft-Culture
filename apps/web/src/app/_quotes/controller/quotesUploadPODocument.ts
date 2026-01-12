import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';

import { protectedProcedure } from '@/lib/trpc/procedures';

import uploadPODocumentSchema from '../schemas/uploadPODocumentSchema';

/**
 * Upload a PO document to Vercel Blob storage
 *
 * @example
 *   await trpcClient.quotes.uploadPODocument.mutate({
 *     file: "data:application/pdf;base64,...",
 *     filename: "PO-12345.pdf",
 *     fileType: "application/pdf"
 *   });
 */
const quotesUploadPODocument = protectedProcedure
  .input(uploadPODocumentSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { file, filename, fileType } = input;

    // Check if Blob token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN environment variable is not set');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'File storage is not configured. Please contact support.',
      });
    }

    try {
      // Extract base64 data from data URL
      const base64Data = file.split(',')[1];
      if (!base64Data) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file format',
        });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Validate file size (max 10MB for PO documents)
      const maxSizeBytes = 10 * 1024 * 1024;
      if (buffer.length > maxSizeBytes) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size must be less than 10MB',
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `po-documents/${user.id}/${timestamp}-${sanitizedFilename}`;

      // Upload to Vercel Blob
      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: fileType,
      });

      return {
        url: blob.url,
      };
    } catch (error) {
      // If it's already a TRPCError, rethrow it
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload PO document. Please try again.',
      });
    }
  });

export default quotesUploadPODocument;

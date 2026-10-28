import { TRPCError } from '@trpc/server';
import { fileTypeFromBuffer } from 'file-type';

import { putPrivateFile } from '@/lib/blob/privateFiles';
import { approvedProcedure } from '@/lib/trpc/procedures';

import uploadPaymentProofSchema from '../schemas/uploadPaymentProofSchema';

// The upload form offers PDF (bank transfer confirmations usually are one),
// so the server must accept it too
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

/**
 * Upload a payment proof (screenshot or PDF) to Vercel Blob storage
 *
 * @example
 *   await trpcClient.quotes.uploadPaymentProof.mutate({
 *     file: "data:image/png;base64,...",
 *     filename: "payment-screenshot.png",
 *     fileType: "image/png"
 *   });
 */
const quotesUploadPaymentProof = approvedProcedure
  .input(uploadPaymentProofSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { file, filename } = input;

    // Check if Blob token is configured
    if (!process.env.BLOB_PRIVATE_READ_WRITE_TOKEN) {
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

      // Validate actual file content type
      const detectedType = await fileTypeFromBuffer(buffer);
      if (!detectedType || !ALLOWED_TYPES.includes(detectedType.mime)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file type. Allowed: PDF, JPEG, PNG, GIF, WebP',
        });
      }

      // Validate file size (max 5MB)
      const maxSizeBytes = 5 * 1024 * 1024;
      if (buffer.length > maxSizeBytes) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size must be less than 5MB',
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `payment-proofs/${user.id}/${timestamp}-${sanitizedFilename}`;

      // Upload to Vercel Blob using detected content type
      // Private store: opened only through /api/files after a login check
      const blob = await putPrivateFile(blobFilename, buffer, detectedType.mime);

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
        message: 'Failed to upload payment proof. Please try again.',
      });
    }
  });

export default quotesUploadPaymentProof;

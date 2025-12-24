import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';

import { protectedProcedure } from '@/lib/trpc/procedures';

import uploadPaymentProofSchema from '../schemas/uploadPaymentProofSchema';

/**
 * Upload a payment proof screenshot to Vercel Blob storage
 *
 * @example
 *   await trpcClient.quotes.uploadPaymentProof.mutate({
 *     file: "data:image/png;base64,...",
 *     filename: "payment-screenshot.png",
 *     fileType: "image/png"
 *   });
 */
const quotesUploadPaymentProof = protectedProcedure
  .input(uploadPaymentProofSchema)
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

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `payment-proofs/${user.id}/${timestamp}-${sanitizedFilename}`;

      // Upload to Vercel Blob
      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: fileType,
      });

      return {
        url: blob.url,
      };
    } catch (error) {
      console.error('Error uploading payment proof:', {
        error,
        userId: user.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      // If it's already a TRPCError, rethrow it
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to upload payment proof: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

export default quotesUploadPaymentProof;

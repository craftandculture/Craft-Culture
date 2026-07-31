import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';

/** Image types accepted for uploaded photos. */
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (client compresses before upload; stays under Vercel 4.5MB body limit after base64)

const uploadReceivingPhotoSchema = z.object({
  shipmentId: z.string().uuid(),
  itemId: z.string(),
  file: z.string().min(1, 'File is required'),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
});

/**
 * Upload a photo during receiving
 *
 * Allows warehouse staff to capture photos of cases during receiving,
 * useful for documenting case condition, label verification, or damage.
 *
 * @example
 *   await trpcClient.wms.admin.receiving.uploadPhoto.mutate({
 *     shipmentId: 'uuid',
 *     itemId: 'item-uuid',
 *     file: 'data:image/jpeg;base64,...',
 *     filename: 'case-photo.jpg',
 *     fileType: 'image/jpeg',
 *   });
 */
const adminUploadReceivingPhoto = wmsOperatorProcedure
  .input(uploadReceivingPhotoSchema)
  .mutation(async ({ input }) => {
    const { shipmentId, itemId, file, filename } = input;

    // Extract base64 data
    const base64Data = file.split(',')[1];
    if (!base64Data) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid file format. Expected base64 data URL.',
      });
    }

    // Convert to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Verify the ACTUAL file type from magic bytes (not the client's claim)
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_IMAGE_MIMES.includes(detected.mime)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported image type' });
    }

    // Sanitize filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const blobFilename = `wms/receiving/${shipmentId}/${itemId}/${timestamp}-${sanitizedFilename}`;

    // Upload to Vercel Blob (using the verified content type)
    const blob = await put(blobFilename, buffer, {
      access: 'public',
      contentType: detected.mime,
    });

    return {
      url: blob.url,
      shipmentId,
      itemId,
      uploadedAt: new Date().toISOString(),
    };
  });

export default adminUploadReceivingPhoto;

import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { and, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';

import db from '@/database/client';
import { logisticsDocuments, logisticsShipments } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import uploadDocumentSchema from '../schemas/uploadDocumentSchema';

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Partner upload a document to a logistics shipment
 *
 * Verifies the partner has access to the shipment before allowing upload.
 * Supports both blobUrl (client upload) and file (base64) modes.
 */
const partnerUploadDocument = winePartnerProcedure.input(uploadDocumentSchema).mutation(async ({ input, ctx }) => {
  const { shipmentId, documentType, documentNumber, issueDate, expiryDate, file, filename, blobUrl, fileType, fileSize } = input;
  const { user, partner } = ctx;

  // Verify shipment exists and belongs to this partner
  const [shipment] = await db
    .select()
    .from(logisticsShipments)
    .where(and(eq(logisticsShipments.id, shipmentId), eq(logisticsShipments.partnerId, partner.id)));

  if (!shipment) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Shipment not found or you do not have access',
    });
  }

  try {
    let finalUrl: string;
    let finalSize: number;
    let finalMimeType: string;

    if (blobUrl) {
      finalUrl = blobUrl;
      finalSize = fileSize ?? 0;
      finalMimeType = fileType;
    } else if (file) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        logger.error('BLOB_READ_WRITE_TOKEN environment variable is not set');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'File storage is not configured. Please contact support.',
        });
      }

      const base64Data = file.split(',')[1];
      if (!base64Data) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file format',
        });
      }

      const buffer = Buffer.from(base64Data, 'base64');

      const detectedType = await fileTypeFromBuffer(buffer);
      if (!detectedType || !ALLOWED_DOCUMENT_TYPES.includes(detectedType.mime)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file type. Allowed: PDF, JPEG, PNG, GIF, WebP',
        });
      }

      const maxSizeBytes = 10 * 1024 * 1024;
      if (buffer.length > maxSizeBytes) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size must be less than 10MB',
        });
      }

      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `logistics/${shipmentId}/${documentType}/${timestamp}-${sanitizedFilename}`;

      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: detectedType.mime,
      });

      finalUrl = blob.url;
      finalSize = buffer.length;
      finalMimeType = detectedType.mime;
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Either file or blobUrl must be provided',
      });
    }

    // Create database record
    const documents = await db
      .insert(logisticsDocuments)
      .values({
        shipmentId,
        documentType,
        documentNumber,
        issueDate,
        expiryDate,
        fileUrl: finalUrl,
        fileName: filename,
        fileSize: finalSize,
        mimeType: finalMimeType,
        uploadedBy: user.id,
      })
      .returning();

    const document = documents[0];
    if (!document) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create document record',
      });
    }

    return document;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    logger.error('Error uploading partner logistics document:', {
      error,
      shipmentId,
      partnerId: partner.id,
      documentType,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to upload document. Please try again.',
    });
  }
});

export default partnerUploadDocument;
